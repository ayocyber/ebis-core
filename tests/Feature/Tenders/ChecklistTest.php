<?php

use App\Enums\TenantRole;
use App\Models\AuditEvent;
use App\Models\ChecklistItem;
use App\Models\CompanyProfile;
use App\Models\Gap;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
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
