<?php

use App\Enums\TenantRole;
use App\Models\AuditEvent;
use App\Models\BidSection;
use App\Models\ChecklistItem;
use App\Models\CompanyProfile;
use App\Models\Gap;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Support\TenderFiles;

beforeEach(function () {
    Storage::fake('local');
    $this->owner = User::factory()->create(['name' => 'Emma Richardson']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();
    inThisCompany($this->tenant, fn () => CompanyProfile::factory()->create([
        'legal_name' => 'Bluewave Networks Ltd', 'company_number' => '08412345', 'incorporated_at' => '2013-03-14',
    ]));

    $this->actingAs($this->owner)->post('/tenders', [
        'files' => [
            TenderFiles::pdf('ITT.pdf', ['Invitation to tender for network services across the county.']),
            TenderFiles::pdf('SQ - Selection questionnaire.pdf', ['Part 1: supplier information. Answer every question.']),
            TenderFiles::pdf('Pricing schedule.pdf', ['Enter your prices for each lot and each site.']),
            TenderFiles::pdf('Appendix B - Declaration form.pdf', ['I declare that the information given is correct.']),
        ],
        'title' => 'Network services', 'buyer_name' => 'Eastbrook City Council', 'buyer_type' => 'local',
        'deadline' => now()->addWeeks(6)->toDateTimeString(),
    ]);
    $this->tender = inThisCompany($this->tenant, fn () => Tender::sole());

    inThisCompany($this->tenant, function () {
        Requirement::query()->delete(); // only the requirements below
        foreach ([
            ['M-01', 'ISO 9001', 'certification', ['type' => 'certification', 'name' => 'ISO 9001']],
            ['M-02', 'Public liability 5m', 'insurance', ['type' => 'insurance_min', 'kind' => 'public', 'amount' => 5_000_000]],
            ['M-03', 'Turnover 1m', 'financial', ['type' => 'turnover_min', 'amount' => 1_000_000]],
        ] as [$code, $title, $topic, $rule]) {
            Requirement::create([
                'tender_id' => $this->tender->id, 'code' => $code, 'title' => $title, 'text' => $title, 'category' => 'mandatory',
                'topic' => $topic, 'check_rule' => $rule, 'origin' => 'manual', 'confirmed_at' => now(),
            ]);
        }
    });
});

function inThisCompany(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

function decideToProceed(object $test): void
{
    $test->post("/tenders/{$test->tender->id}/eligibility");
    $gaps = inThisCompany($test->tenant, fn () => Gap::pluck('id')->all());
    $test->post("/tenders/{$test->tender->id}/decision", ['outcome' => 'proceed', 'acknowledged_blockers' => $gaps]);
}

function checklistItem(Tenant $tenant, string $title): ChecklistItem
{
    return inThisCompany($tenant, fn () => ChecklistItem::where('title', $title)->sole());
}

it('opens only after deciding to bid', function () {
    $this->get("/tenders/{$this->tender->id}/documents")->assertRedirect("/tenders/{$this->tender->id}/decision")->assertSessionHas('error');
});

it('works out the checklist from the pack and the requirements, once', function () {
    decideToProceed($this);

    $this->get("/tenders/{$this->tender->id}/documents")->assertInertia(fn ($page) => $page
        ->component('tenders/live/documents')
        ->has('items', 7)
        ->has('sections'));
    $this->get("/tenders/{$this->tender->id}/documents"); // running again adds nothing

    $items = inThisCompany($this->tenant, fn () => ChecklistItem::orderBy('position')->get()->keyBy('title'));
    expect($items)->toHaveCount(7)
        ->and($items->keys()->all())->toContain(
            'Written response',
            'Selection questionnaire: supplier information',
            'Completed pricing schedule',
            'Completed Appendix B - Declaration form',
            'ISO 9001 certificate',
            'Public liability insurance certificate',
            'Audited accounts',
        )
        ->and($items['Completed pricing schedule']->formats)->toBe(['xlsx', 'pdf'])
        ->and($items['Completed Appendix B - Declaration form']->signature)->toBeTrue()
        ->and($items['ISO 9001 certificate']->kind)->toBe('company')
        ->and($items['ISO 9001 certificate']->vault_match)->toBe('ISO\W*(?:IEC\W*)?9001');
});

it('pre-fills the selection questionnaire from the company profile', function () {
    decideToProceed($this);
    $this->get("/tenders/{$this->tender->id}/documents")->assertInertia(function ($page) {
        $sq = collect($page->toArray()['props']['items'])->firstWhere('kind', 'form');
        $fields = collect($sq['fields'])->keyBy('id');

        expect($fields['legal_name']['prefill'])->toBe('Bluewave Networks Ltd')
            ->and($fields['legal_name']['from'])->toBe('Company profile')
            ->and($fields['incorporated']['prefill'])->toBe('14 March 2013')
            ->and($fields['contact_email'])->not->toHaveKey('prefill');
    });
});

it('saves form answers, marks items not needed, and logs it', function () {
    decideToProceed($this);
    $this->get("/tenders/{$this->tender->id}/documents");
    $sq = checklistItem($this->tenant, 'Selection questionnaire: supplier information');
    $url = "/tenders/{$this->tender->id}/checklist/{$sq->id}";

    $this->patch($url, ['progress' => ['fields' => ['contact_email' => 'bids@bluewave.example']]]);
    expect($sq->fresh()->progress['fields']['contact_email'])->toBe('bids@bluewave.example');

    $this->patch($url, ['progress' => ['notApplicable' => true]]);
    expect($sq->fresh()->progress['notApplicable'])->toBeTrue();

    $this->patch($url, ['progress' => null]);
    expect($sq->fresh()->progress)->toBeNull();

    $actions = inThisCompany($this->tenant, fn () => AuditEvent::where('category', 'documents')->orderBy('id')->pluck('action')->all());
    expect($actions)->toBe(['filled in', 'marked as not needed', 'reset']);
});

it('stores uploaded files, replaces them, and removes them', function () {
    decideToProceed($this);
    $this->get("/tenders/{$this->tender->id}/documents");
    $pricing = checklistItem($this->tenant, 'Completed pricing schedule');
    $base = "/tenders/{$this->tender->id}/checklist/{$pricing->id}";

    $this->post("{$base}/file", ['file' => UploadedFile::fake()->create('Prices v1.xlsx', 40)])->assertSessionHas('success');
    $first = $pricing->fresh()->file_path;
    Storage::disk('local')->assertExists($first);
    expect($pricing->fresh()->progress['fileName'])->toBe('Prices v1.xlsx')
        ->and($pricing->fresh()->progress['uploadedBy'])->toBe('Emma Richardson');
    $this->get("{$base}/file")->assertOk()->assertDownload('Prices v1.xlsx');

    // Replacing removes the old file.
    $this->post("{$base}/file", ['file' => UploadedFile::fake()->create('Prices v2.xlsx', 40)]);
    Storage::disk('local')->assertMissing($first);

    // Removing it (fileName null) deletes the file too.
    $this->patch($base, ['progress' => ['fileName' => null]]);
    expect($pricing->fresh()->file_path)->toBeNull()->and($pricing->fresh()->progress)->not->toHaveKey('fileName');
    $this->get("{$base}/file")->assertNotFound();
});

it('lets viewers look but not change anything, and keeps other companies out', function () {
    decideToProceed($this);
    $this->get("/tenders/{$this->tender->id}/documents");
    $pricing = checklistItem($this->tenant, 'Completed pricing schedule');

    $viewer = User::factory()->create();
    $this->tenant->addMember($viewer, TenantRole::Viewer);
    $viewer->switchTenant($this->tenant);
    $this->actingAs($viewer)->get("/tenders/{$this->tender->id}/documents")->assertOk();
    $this->patch("/tenders/{$this->tender->id}/checklist/{$pricing->id}", ['progress' => ['notApplicable' => true]])->assertForbidden();
    $this->post("/tenders/{$this->tender->id}/checklist/{$pricing->id}/file", ['file' => UploadedFile::fake()->create('x.xlsx', 5)])->assertForbidden();

    $rival = User::factory()->create();
    Tenant::factory()->ownedBy($rival)->create();
    $this->actingAs($rival)->get("/tenders/{$this->tender->id}/documents")->assertNotFound();
    $this->get("/tenders/{$this->tender->id}/checklist/{$pricing->id}/file")->assertNotFound();
});

/** @return array<string, string> entry name => contents */
function packEntries(string $zipBytes): array
{
    $path = tempnam(sys_get_temp_dir(), 'test');
    file_put_contents($path, $zipBytes);
    $zip = new ZipArchive;
    $zip->open($path);
    $entries = [];
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = (string) $zip->getNameIndex($i);
        $entries[$name] = (string) $zip->getFromIndex($i);
    }
    $zip->close();
    unlink($path);

    return $entries;
}

function docxText(string $docx): string
{
    return strip_tags(str_replace('</w:p>', "\n", (string) (packEntries($docx)['word/document.xml'] ?? '')));
}

it('downloads the submission pack with every file under the buyer’s naming, and lists what is missing', function () {
    $this->tenant->forceFill(['name' => 'Bluewave Networks'])->save();
    $this->tender->forceFill(['reference' => 'ECC-NET-2026-01'])->save();
    decideToProceed($this);
    $this->get("/tenders/{$this->tender->id}/documents");

    inThisCompany($this->tenant, function () {
        BidSection::where('tender_id', $this->tender->id)->orderBy('position')->first()
            ->forceFill(['title' => 'Approach', 'body' => "We run the network from two sites.\n\nEngineers are on call all day."])->save();
        Storage::disk('local')->put('tenants/test/vault/iso.pdf', '%PDF iso');
        VaultDocument::factory()->create(['title' => 'ISO 9001:2015 certificate', 'path' => 'tenants/test/vault/iso.pdf']);
    });
    $pricing = checklistItem($this->tenant, 'Completed pricing schedule');
    $this->post("/tenders/{$this->tender->id}/checklist/{$pricing->id}/file", ['file' => UploadedFile::fake()->createWithContent('my prices.xlsx', 'prices')]);
    $declaration = checklistItem($this->tenant, 'Completed Appendix B - Declaration form');
    $this->patch("/tenders/{$this->tender->id}/checklist/{$declaration->id}", ['progress' => ['notApplicable' => true]]);

    $response = $this->get("/tenders/{$this->tender->id}/pack")->assertOk()->assertDownload('ECC-NET-2026-01_Bluewave-Networks_SubmissionPack.zip');
    $entries = packEntries($response->streamedContent() ?: file_get_contents($response->baseResponse->getFile()->getPathname()));
    $names = array_keys($entries);
    $prefix = 'ECC-NET-2026-01_Bluewave-Networks_';

    expect($names)->toContain('00_Contents.txt')
        ->and(collect($names)->filter(fn ($n) => str_ends_with($n, '.xlsx'))->first())->toStartWith($prefix)
        ->and($entries[collect($names)->first(fn ($n) => str_ends_with($n, '.xlsx'))])->toBe('prices')
        ->and($entries[collect($names)->first(fn ($n) => str_contains($n, 'ISO'))])->toBe('%PDF iso');

    $response = collect($names)->first(fn ($n) => str_starts_with($n, $prefix) && str_ends_with($n, '.docx') && docxText($entries[$n]) !== '' && str_contains(docxText($entries[$n]), 'Approach'));
    expect(docxText($entries[$response]))->toContain('We run the network from two sites.')->toContain('Engineers are on call all day.');

    $sq = collect($names)->first(fn ($n) => str_ends_with($n, '.docx') && str_contains(docxText($entries[$n]), 'Selection questionnaire'));
    expect(docxText($entries[$sq]))->toContain('Bluewave Networks Ltd')->toContain('08412345');

    $contents = $entries['00_Contents.txt'];
    expect($contents)->toContain('NOT in this pack')
        ->toContain('Public liability insurance certificate')
        ->toContain('Audited accounts')
        ->not->toContain('Declaration form'); // marked not needed

    $log = inThisCompany($this->tenant, fn () => AuditEvent::where('action', 'downloaded the submission pack for')->sole());
    expect($log->detail)->toBe('4 files, 2 missing');
});

it('downloads a form filled in with the answers on screen, without saving them', function () {
    decideToProceed($this);
    $this->get("/tenders/{$this->tender->id}/documents");
    $sq = checklistItem($this->tenant, 'Selection questionnaire: supplier information');

    $response = $this->postJson("/tenders/{$this->tender->id}/checklist/{$sq->id}/form", ['fields' => ['contact_email' => 'bids@bluewave.example']])->assertOk();
    $text = docxText(file_get_contents($response->baseResponse->getFile()->getPathname()));
    expect($text)->toContain('bids@bluewave.example')->toContain('Bluewave Networks Ltd')
        ->and($sq->fresh()->progress)->toBeNull();

    $pricing = checklistItem($this->tenant, 'Completed pricing schedule');
    $this->postJson("/tenders/{$this->tender->id}/checklist/{$pricing->id}/form")->assertNotFound();
});

it('keeps the pack from other companies and before a decision to bid', function () {
    $this->get("/tenders/{$this->tender->id}/pack")->assertStatus(409);
    decideToProceed($this);

    $rival = User::factory()->create();
    Tenant::factory()->ownedBy($rival)->create();
    $this->actingAs($rival)->get("/tenders/{$this->tender->id}/pack")->assertNotFound();
});
