<?php

use App\Enums\TenantRole;
use App\Models\AuditEvent;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Support\Facades\Storage;
use Tests\Support\TenderFiles;

beforeEach(function () {
    Storage::fake('local');
    $this->owner = User::factory()->create(['name' => 'Emma Richardson']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();

    $this->actingAs($this->owner)->post('/tenders', [
        'files' => [TenderFiles::pdf('ITT.pdf', [
            '1. Tenders must be submitted through the council portal.',
            '4. Selection criteria 4.1 Minimum annual turnover of GBP 900,000 in each of the last two financial years. '
            ."4.2 Cyber Essentials Plus certification, valid on the submission deadline. 4.3 Public liability insurance of at least GBP 5,000,000 and employer's liability of GBP 10,000,000.",
        ])],
        'title' => 'Library Wi-Fi',
        'buyer_name' => 'Eastbrook City Council',
        'buyer_type' => 'local',
        'deadline' => now()->addWeeks(3)->toDateTimeString(),
    ]);
    $this->tender = asCompany($this->tenant, fn () => Tender::with('documents')->sole());
});

function asCompany(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

function requirementInput(array $overrides = []): array
{
    return [
        'title' => 'ISO 9001',
        'text' => 'The supplier must hold ISO 9001 certification.',
        'category' => 'mandatory',
        'topic' => 'certification',
        'check' => ['type' => 'certification', 'name' => 'ISO 9001'],
        ...$overrides,
    ];
}

it('suggests requirements from the text, with the rule that checks each one', function () {
    $s = asCompany($this->tenant, fn () => Requirement::suggested()->orderBy('page')->orderBy('section')->get());

    expect($s->pluck('title')->all())->toBe([
        'Tenders must be submitted through the council portal',
        'Minimum annual turnover of GBP 900,000 in each of the last two financial years',
        'Cyber Essentials Plus certification, valid on the submission deadline',
        'Public liability insurance of at least £5,000,000',
        'Employer’s liability insurance of at least £10,000,000',
    ])
        ->and($s[1]->check_rule)->toBe(['type' => 'turnover_min', 'amount' => 900000, 'years' => 2])
        ->and($s[2]->check_rule)->toBe(['type' => 'certification', 'name' => 'Cyber Essentials Plus'])
        ->and($s[4]->check_rule)->toBe(['type' => 'insurance_min', 'kind' => 'employers', 'amount' => 10000000])
        // The quote is the tender's own words, with page and clause.
        ->and($s[1]->quote)->toStartWith('4.1 Minimum annual turnover')
        ->and($s[1]->page)->toBe(2)
        ->and($s[1]->section)->toBe('4.1')
        ->and($s->every(fn ($r) => $r->code === null && $r->origin === 'found'))->toBeTrue();
});

it('confirms suggestions with codes per category, and logs it', function () {
    $first = asCompany($this->tenant, fn () => Requirement::suggested()->orderBy('page')->first());

    $this->post("/tenders/{$this->tender->id}/requirements/confirm/{$first->id}")->assertSessionHas('success');
    expect($first->fresh()->code)->toBe('M-01');

    $this->post("/tenders/{$this->tender->id}/requirements/confirm")->assertSessionHas('success', '4 requirements confirmed.');

    $codes = asCompany($this->tenant, fn () => Requirement::confirmed()->pluck('code')->sort()->values()->all());
    expect($codes)->toBe(['M-01', 'M-02', 'M-03', 'M-04', 'M-05'])
        ->and(asCompany($this->tenant, fn () => AuditEvent::where('action', 'like', 'confirmed%')->count()))->toBe(2);
});

it('does not suggest a dismissed sentence again when the document is read again', function () {
    $s = asCompany($this->tenant, fn () => Requirement::suggested()->orderBy('page')->first());
    $this->delete("/tenders/{$this->tender->id}/requirements/{$s->id}")->assertSessionHas('success', 'Suggestion dismissed.');

    $doc = $this->tender->documents->first();
    $this->post("/tenders/{$this->tender->id}/documents/{$doc->id}/retry");

    expect(asCompany($this->tenant, fn () => Requirement::suggested()->count()))->toBe(4);
});

it('adds a requirement by hand, and validates the check', function () {
    $this->post("/tenders/{$this->tender->id}/requirements", requirementInput())->assertSessionHas('success', 'M-01 added.');

    $req = asCompany($this->tenant, fn () => Requirement::confirmed()->sole());
    expect($req->origin)->toBe('manual')
        ->and($req->check_rule)->toBe(['type' => 'certification', 'name' => 'ISO 9001']);

    // An insurance rule needs the kind and an amount.
    $this->post("/tenders/{$this->tender->id}/requirements", requirementInput(['check' => ['type' => 'insurance_min']]))
        ->assertSessionHasErrors(['check.amount', 'check.kind']);

    // "You decide" is stored as no rule; weight only applies to scored requirements.
    $this->post("/tenders/{$this->tender->id}/requirements", requirementInput(['title' => 'Method statement', 'weight' => 20, 'check' => ['type' => 'judgement']]));
    $judgement = asCompany($this->tenant, fn () => Requirement::where('title', 'Method statement')->sole());
    expect($judgement->check_rule)->toBeNull()->and($judgement->weight)->toBeNull();
});

it('versions edits, gives a new code when the type changes, and never reuses codes', function () {
    $this->post("/tenders/{$this->tender->id}/requirements", requirementInput());
    $req = asCompany($this->tenant, fn () => Requirement::confirmed()->sole());

    $this->patch("/tenders/{$this->tender->id}/requirements/{$req->id}", requirementInput(['title' => 'ISO 9001:2015', 'category' => 'scored', 'weight' => 10]))
        ->assertSessionHas('success');

    $req->refresh();
    expect($req->version)->toBe(2)->and($req->code)->toBe('S-01')->and($req->weight)->toBe(10);
    $edit = asCompany($this->tenant, fn () => AuditEvent::where('action', 'edited requirement')->sole());
    expect($edit->detail)->toBe('“ISO 9001” → “ISO 9001:2015”');

    $this->delete("/tenders/{$this->tender->id}/requirements/{$req->id}")->assertSessionHas('success', 'S-01 removed.');
    $this->post("/tenders/{$this->tender->id}/requirements", requirementInput(['category' => 'scored']))->assertSessionHas('success', 'S-02 added.');
});

it('only links a requirement to a document of the same tender', function () {
    $this->post("/tenders/{$this->tender->id}/requirements", requirementInput(['document_id' => (string) Str::uuid()]))
        ->assertSessionHasErrors('document_id');

    $this->post("/tenders/{$this->tender->id}/requirements", requirementInput(['document_id' => $this->tender->documents->first()->id, 'page' => 2]))
        ->assertSessionHasNoErrors();
});

it('shows the requirements page for real tenders', function () {
    $this->get("/tenders/{$this->tender->id}/requirements")->assertInertia(fn ($page) => $page
        ->component('tenders/live/requirements')
        ->has('suggestions', 5)
        ->has('requirements', 0)
        ->where('suggestions.0.source.documentName', 'ITT.pdf'));

    $this->get("/tenders/{$this->tender->id}")->assertInertia(fn ($page) => $page
        ->where('requirementCounts', ['confirmed' => 0, 'suggested' => 5]));
});

it('lets viewers read but not change requirements, and keeps companies apart', function () {
    $s = asCompany($this->tenant, fn () => Requirement::suggested()->first());

    $viewer = User::factory()->create();
    $this->tenant->addMember($viewer, TenantRole::Viewer);
    $viewer->switchTenant($this->tenant);
    $this->actingAs($viewer)->get("/tenders/{$this->tender->id}/requirements")->assertOk();
    $this->post("/tenders/{$this->tender->id}/requirements", requirementInput())->assertForbidden();
    $this->post("/tenders/{$this->tender->id}/requirements/confirm")->assertForbidden();
    $this->delete("/tenders/{$this->tender->id}/requirements/{$s->id}")->assertForbidden();

    $rival = User::factory()->create();
    Tenant::factory()->ownedBy($rival)->create();
    $this->actingAs($rival)->get("/tenders/{$this->tender->id}/requirements")->assertNotFound();
    $this->post("/tenders/{$this->tender->id}/requirements/confirm/{$s->id}")->assertNotFound();
});

it('back-fills suggestions for documents read before suggestions existed, once', function () {
    // As if the document had been read by an older version: no requirements yet.
    asCompany($this->tenant, fn () => Requirement::query()->forceDelete());

    $this->artisan('tenders:suggest-requirements')->expectsOutput('5 requirement suggestions added.')->assertSuccessful();
    $this->artisan('tenders:suggest-requirements')->expectsOutput('0 requirement suggestions added.')->assertSuccessful();

    expect(asCompany($this->tenant, fn () => Requirement::suggested()->count()))->toBe(5);
});
