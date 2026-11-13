<?php

use App\Enums\ExtractionStatus;
use App\Enums\TenantRole;
use App\Enums\TenderStage;
use App\Models\AuditEvent;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\TenderDocument;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Support\TenderFiles;

beforeEach(function () {
    Storage::fake('local');
    $this->owner = User::factory()->create(['name' => 'Emma Richardson']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();
});

/** Runs a query as the given company, like the `tenant` middleware does. */
function inTenant(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

function tenderMember(Tenant $tenant, TenantRole $role): User
{
    $user = User::factory()->create();
    $tenant->addMember($user, $role);
    $user->switchTenant($tenant);

    return $user;
}

/** @param list<UploadedFile> $files */
function tenderUpload(array $files, array $overrides = []): array
{
    return [
        'files' => $files,
        'title' => 'Enterprise network refresh',
        'reference' => 'NCC/ICT/2026/014',
        'buyer_name' => 'Northshire County Council',
        'buyer_type' => 'local',
        'deadline' => now()->addWeeks(3)->toDateTimeString(),
        'estimated_value' => 3200000,
        ...$overrides,
    ];
}

function itt(string $name = 'ITT - Instructions.pdf'): UploadedFile
{
    return TenderFiles::pdf($name, ['Invitation to tender for the supply of network infrastructure.']);
}

it('turns an upload into one tender, reads every document and logs it', function () {
    $response = $this->actingAs($this->owner)->post('/tenders', tenderUpload([
        itt(),
        TenderFiles::docx('Specification.docx', "Section 1 Requirements\nThe supplier must hold Cyber Essentials Plus."),
    ]));

    $tender = inTenant($this->tenant, fn () => Tender::with('documents')->sole());
    $response->assertRedirect("/tenders/{$tender->id}")->assertSessionHas('success');

    expect($tender->title)->toBe('Enterprise network refresh')
        ->and($tender->stage)->toBe(TenderStage::Requirements)
        ->and($tender->documents)->toHaveCount(2);

    [$pdf, $docx] = [$tender->documents->firstWhere('kind', 'pdf'), $tender->documents->firstWhere('kind', 'docx')];
    expect($pdf->role)->toBe('Invitation to tender')
        ->and($pdf->extraction_status)->toBe(ExtractionStatus::Done)
        ->and($pdf->pages)->toBe(1)
        ->and($pdf->makeVisible('extracted_text')->extracted_text)->toContain('supply of network infrastructure')
        ->and($pdf->path)->toStartWith("tenants/{$this->tenant->id}/tenders/")
        ->and($docx->role)->toBe('Specification')
        ->and($docx->extraction_status)->toBe(ExtractionStatus::Done)
        ->and($docx->pages)->toBe(3)
        ->and($docx->makeVisible('extracted_text')->extracted_text)->toContain('must hold Cyber Essentials Plus');
    Storage::disk('local')->assertExists($pdf->path);

    $event = inTenant($this->tenant, fn () => AuditEvent::sole());
    expect($event->action)->toBe('uploaded the tender')
        ->and($event->target)->toBe('NCC/ICT/2026/014 · Enterprise network refresh')
        ->and($event->tender_id)->toBe($tender->id);
});

it('reports scanned pages instead of skipping them', function () {
    $this->actingAs($this->owner)->post('/tenders', tenderUpload([
        TenderFiles::pdf('Pack.pdf', ['Page one has real text about the contract.', '', 'Page three has text too, about pricing.']),
        TenderFiles::pdf('Scanned form.pdf', ['', '']),
    ]))->assertSessionHasNoErrors();

    $docs = inTenant($this->tenant, fn () => TenderDocument::all()->keyBy('name'));

    expect($docs['Pack.pdf']->extraction_status)->toBe(ExtractionStatus::Partial)
        ->and($docs['Pack.pdf']->unreadable_pages)->toBe([2])
        ->and($docs['Pack.pdf']->pages)->toBe(3)
        ->and($docs['Scanned form.pdf']->extraction_status)->toBe(ExtractionStatus::Failed)
        ->and($docs['Scanned form.pdf']->extraction_error)->toContain('scanned');
});

it('unpacks a ZIP into the documents of one tender and reports what it skipped', function () {
    $zip = TenderFiles::zip('Tender pack.zip', [
        'pack/ITT.pdf' => itt(),
        'pack/Pricing schedule.docx' => TenderFiles::docx('x.docx', 'Complete the pricing schedule for every lot and site.'),
        'pack/Pricing.xlsx' => 'not read',
        '__MACOSX/pack/._ITT.pdf' => 'mac junk',
        'pack/.DS_Store' => 'junk',
    ]);

    $this->actingAs($this->owner)->post('/tenders', tenderUpload([$zip]))
        ->assertSessionHas('success', fn (string $m) => str_contains($m, 'Skipped: Pricing.xlsx'));

    $docs = inTenant($this->tenant, fn () => TenderDocument::orderBy('name')->get());
    expect($docs->pluck('name')->all())->toBe(['ITT.pdf', 'Pricing schedule.docx'])
        ->and($docs->pluck('from_archive')->unique()->all())->toBe(['Tender pack.zip'])
        ->and($docs->pluck('role')->all())->toBe(['Invitation to tender', 'Pricing schedule'])
        ->and($docs->every(fn ($d) => $d->extraction_status === ExtractionStatus::Done))->toBeTrue();
});

it('rejects a ZIP with nothing readable in it', function () {
    $zip = TenderFiles::zip('Spreadsheets.zip', ['a.xlsx' => 'x', 'b.csv' => 'y']);

    $this->actingAs($this->owner)->post('/tenders', tenderUpload([$zip]))->assertSessionHasErrors('files');
    expect(inTenant($this->tenant, fn () => Tender::count()))->toBe(0);
});

it('only accepts PDF, DOCX or ZIP files up to 50 MB, and needs a deadline', function () {
    $this->actingAs($this->owner)->post('/tenders', tenderUpload([UploadedFile::fake()->create('notes.txt', 10)]))
        ->assertSessionHasErrors(['files.0' => 'Only PDF, Word (DOCX) or ZIP files can be uploaded.']);

    $this->post('/tenders', tenderUpload([UploadedFile::fake()->create('huge.pdf', 51 * 1024, 'application/pdf')]))
        ->assertSessionHasErrors(['files.0' => 'Each file can be up to 50 MB.']);

    $this->post('/tenders', tenderUpload([itt()], ['deadline' => null]))->assertSessionHasErrors('deadline');
    $this->post('/tenders', tenderUpload([]))->assertSessionHasErrors('files');

    expect(inTenant($this->tenant, fn () => Tender::count()))->toBe(0);
});

it('spots a tender it already has, by reference or by identical file', function () {
    $this->actingAs($this->owner)->post('/tenders', tenderUpload([itt()]));
    $first = inTenant($this->tenant, fn () => Tender::sole());

    // Same reference, different case and spacing.
    $this->post('/tenders', tenderUpload([itt('Other.pdf')], ['reference' => ' ncc/ict/2026/014 ']))
        ->assertSessionHas('duplicate', fn (array $d) => $d['tender']['id'] === $first->id
            && str_contains($d['message'], 'reference'));

    // Same file under another reference.
    $this->post('/tenders', tenderUpload([itt()], ['reference' => 'OTHER/1']))
        ->assertSessionHas('duplicate', fn (array $d) => str_contains($d['message'], 'already part of another tender'));

    expect(inTenant($this->tenant, fn () => Tender::count()))->toBe(1);

    // The user chose to upload it anyway.
    $this->post('/tenders', tenderUpload([itt()], ['allow_duplicate' => true]))->assertSessionHas('success');
    expect(inTenant($this->tenant, fn () => Tender::count()))->toBe(2);
});

it('adds documents to a pack, skipping ones it already has', function () {
    $this->actingAs($this->owner)->post('/tenders', tenderUpload([itt()]));
    $tender = inTenant($this->tenant, fn () => Tender::sole());

    $this->post("/tenders/{$tender->id}/documents", ['files' => [itt(), TenderFiles::pdf('Clarifications.pdf', ['Answers to supplier clarification questions.'])]])
        ->assertSessionHas('success', fn (string $m) => str_contains($m, '1 document added') && str_contains($m, 'already in this tender'));

    $tender = inTenant($this->tenant, fn () => Tender::with('documents')->sole());
    expect($tender->documents)->toHaveCount(2)
        ->and($tender->version)->toBe(2)
        ->and($tender->stage)->toBe(TenderStage::Requirements);
});

it('removes a document but never the last one', function () {
    $this->actingAs($this->owner)->post('/tenders', tenderUpload([itt(), TenderFiles::pdf('Spec.pdf', ['The specification of the network services.'])]));
    $tender = inTenant($this->tenant, fn () => Tender::with('documents')->sole());
    [$a, $b] = $tender->documents;

    $this->delete("/tenders/{$tender->id}/documents/{$a->id}")->assertSessionHas('success');
    $this->delete("/tenders/{$tender->id}/documents/{$b->id}")->assertSessionHas('error');

    expect(inTenant($this->tenant, fn () => TenderDocument::count()))->toBe(1);
});

it('edits the details and deletes the tender, logging both', function () {
    $this->actingAs($this->owner)->post('/tenders', tenderUpload([itt()]));
    $tender = inTenant($this->tenant, fn () => Tender::sole());

    $this->patch("/tenders/{$tender->id}", [
        'title' => 'Enterprise network refresh (lot 1)',
        'buyer_name' => 'Northshire County Council',
        'buyer_type' => 'local',
        'deadline' => now()->addWeeks(4)->toDateTimeString(),
        'lots' => 2,
    ])->assertSessionHas('success');

    $tender->refresh();
    expect(inTenant($this->tenant, fn () => Tender::sole()->lots))->toBe(2);

    $this->delete("/tenders/{$tender->id}")->assertRedirect('/tenders');
    expect(inTenant($this->tenant, fn () => Tender::count()))->toBe(0)
        ->and(inTenant($this->tenant, fn () => AuditEvent::pluck('action')->all()))
        ->toContain('edited the details of', 'deleted the tender');
});

it('reads a failed document again on request', function () {
    $this->actingAs($this->owner)->post('/tenders', tenderUpload([itt()]));
    $doc = inTenant($this->tenant, fn () => TenderDocument::sole());
    $doc->forceFill(['extraction_status' => ExtractionStatus::Failed, 'extraction_error' => 'Timed out'])->save();

    $this->post("/tenders/{$doc->tender_id}/documents/{$doc->id}/retry")->assertSessionHas('success');

    expect($doc->fresh()->extraction_status)->toBe(ExtractionStatus::Done)
        ->and($doc->fresh()->extraction_error)->toBeNull();
});

it('lists and shows tenders in the shape the frontend expects', function () {
    $this->actingAs($this->owner)->post('/tenders', tenderUpload([itt()]));
    $tender = inTenant($this->tenant, fn () => Tender::sole());

    $this->get('/tenders')->assertInertia(fn ($page) => $page
        ->component('tenders/index')
        ->has('tenders', 1)
        ->where('tenders.0.id', $tender->id)
        ->where('tenders.0.buyer.name', 'Northshire County Council')
        ->where('tenders.0.estimatedValue.amount', 3200000)
        ->where('tenders.0.owner.initials', 'ER')
        ->where('tenders.0.documents.0.extraction.status', 'done')
        ->missing('tenders.0.documents.0.extractedText'));

    $this->get("/tenders/{$tender->id}")->assertInertia(fn ($page) => $page
        ->component('tenders/show')
        ->where('tender.stage', 'requirements')
        ->where('tender.documents.0.role', 'Invitation to tender'));

    // Sample-only stage pages send real tenders to their own page.
    $this->get("/tenders/{$tender->id}/validation")->assertRedirect("/tenders/{$tender->id}");
});

it('lets viewers look but not upload or change anything', function () {
    $this->actingAs($this->owner)->post('/tenders', tenderUpload([itt()]));
    $tender = inTenant($this->tenant, fn () => Tender::with('documents')->sole());
    $doc = $tender->documents->first();
    $viewer = tenderMember($this->tenant, TenantRole::Viewer);

    $this->actingAs($viewer)->get("/tenders/{$tender->id}")->assertOk();
    $this->get("/tenders/{$tender->id}/documents/{$doc->id}/download")->assertOk();
    $this->post('/tenders', tenderUpload([itt('New.pdf')], ['reference' => 'NEW/1']))->assertForbidden();
    $this->post("/tenders/{$tender->id}/documents", ['files' => [itt('More.pdf')]])->assertForbidden();
    $this->patch("/tenders/{$tender->id}", ['title' => 'Changed'])->assertForbidden();
    $this->delete("/tenders/{$tender->id}/documents/{$doc->id}")->assertForbidden();
    $this->delete("/tenders/{$tender->id}")->assertForbidden();
});

it('keeps tenders separate between companies', function () {
    $this->actingAs($this->owner)->post('/tenders', tenderUpload([itt()]));
    $tender = inTenant($this->tenant, fn () => Tender::with('documents')->sole());
    $doc = $tender->documents->first();

    $rival = User::factory()->create();
    Tenant::factory()->ownedBy($rival)->create();

    $this->actingAs($rival)->get('/tenders')->assertInertia(fn ($page) => $page->has('tenders', 0));
    $this->get("/tenders/{$tender->id}")->assertNotFound();
    $this->get("/tenders/{$tender->id}/documents/{$doc->id}/download")->assertNotFound();
    $this->post("/tenders/{$tender->id}/documents", ['files' => [itt('x.pdf')]])->assertNotFound();
    $this->delete("/tenders/{$tender->id}")->assertNotFound();

    // Their own upload of the same pack is not a duplicate of ours.
    $this->post('/tenders', tenderUpload([itt()]))->assertSessionHas('success');
});
