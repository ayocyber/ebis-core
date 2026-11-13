<?php

use App\Enums\TenantRole;
use App\Models\AuditEvent;
use App\Models\BidSection;
use App\Models\BidSectionVersion;
use App\Models\CompanyProfile;
use App\Models\Gap;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;

beforeEach(function () {
    $this->owner = User::factory()->create(['name' => 'Emma Richardson']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();

    $this->tender = withCompany($this->tenant, function () {
        CompanyProfile::factory()->create(['turnover' => [['year' => 'FY25', 'amount' => 1_500_000]]]);
        $tender = Tender::factory()->create(['deadline' => now()->addWeeks(6)->setTime(12, 0)]);
        foreach ([
            ['M-01', 'Turnover 1m', 'mandatory', 'financial', ['type' => 'turnover_min', 'amount' => 1_000_000], null],
            ['M-02', 'ISO 9001', 'mandatory', 'certification', ['type' => 'certification', 'name' => 'ISO 9001'], null],
            ['M-03', 'Submit on the portal', 'mandatory', 'submission', null, null],
            ['S-01', 'Implementation plan', 'scored', 'technical', null, 30],
        ] as [$code, $title, $category, $topic, $rule, $weight]) {
            Requirement::create([
                'tender_id' => $tender->id, 'code' => $code, 'title' => $title, 'text' => $title, 'category' => $category,
                'topic' => $topic, 'weight' => $weight, 'check_rule' => $rule, 'origin' => 'manual', 'confirmed_at' => now(),
            ]);
        }

        return $tender;
    });
});

function withCompany(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

function decideToBid(object $test): void
{
    $test->actingAs($test->owner)->post("/tenders/{$test->tender->id}/eligibility");
    $gaps = withCompany($test->tenant, fn () => Gap::pluck('id')->all());
    $test->post("/tenders/{$test->tender->id}/decision", ['outcome' => 'proceed', 'acknowledged_blockers' => $gaps]);
}

function sectionTitled(Tenant $tenant, string $title): BidSection
{
    return withCompany($tenant, fn () => BidSection::where('title', $title)->sole());
}

it('waits for a decision to bid before the bid stage opens', function () {
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility");

    $this->get("/tenders/{$this->tender->id}/compliance")->assertRedirect("/tenders/{$this->tender->id}/decision")->assertSessionHas('error');
    $this->get("/tenders/{$this->tender->id}/bid")->assertRedirect("/tenders/{$this->tender->id}/decision");
    expect(withCompany($this->tenant, fn () => BidSection::count()))->toBe(0);
});

it('creates the bid sections from the requirements when deciding to bid', function () {
    decideToBid($this);

    $sections = withCompany($this->tenant, fn () => BidSection::orderBy('position')->get());
    expect($sections->pluck('title')->all())->toBe(['Financial standing', 'Certifications and accreditations', 'Implementation plan'])
        // Submission rules are not written answers; they belong in the checklist.
        ->and($sections->flatMap->requirement_ids->count())->toBe(3);

    $this->get("/tenders/{$this->tender->id}/compliance")->assertInertia(fn ($page) => $page
        ->component('tenders/live/compliance')->has('rows', 4)->has('sections', 3));
    $this->get("/tenders/{$this->tender->id}/bid")->assertInertia(fn ($page) => $page
        ->component('tenders/live/bid')->has('sections', 3)->has('versions'));
});

it('moves a requirement between sections, or out of all of them', function () {
    decideToBid($this);
    $iso = withCompany($this->tenant, fn () => Requirement::where('code', 'M-02')->sole());
    $finance = sectionTitled($this->tenant, 'Financial standing');

    $this->post("/tenders/{$this->tender->id}/compliance/map", ['requirement_id' => $iso->id, 'section_id' => $finance->id]);
    expect($finance->fresh()->requirement_ids)->toContain($iso->id)
        ->and(sectionTitled($this->tenant, 'Certifications and accreditations')->requirement_ids)->toBe([]);

    $this->post("/tenders/{$this->tender->id}/compliance/map", ['requirement_id' => $iso->id, 'section_id' => null]);
    expect($finance->fresh()->requirement_ids)->not->toContain($iso->id)
        ->and(withCompany($this->tenant, fn () => AuditEvent::where('action', 'like', '%mapped a requirement%')->count()))->toBe(2);
});

it('autosaves text, logs status changes and keeps restorable versions', function () {
    decideToBid($this);
    $s = sectionTitled($this->tenant, 'Implementation plan');
    $url = "/tenders/{$this->tender->id}/sections/{$s->id}";

    $this->patchJson($url, ['body' => 'First draft.'])->assertOk()->assertJsonPath('section.body', 'First draft.');
    $this->patchJson($url, ['status' => 'finished'])->assertJsonValidationErrors('status');
    $this->patchJson($url, ['status' => 'drafting'])->assertOk();

    $this->postJson("{$url}/versions", ['label' => 'Edited', 'body' => 'First draft.'])->assertJsonPath('version.label', 'Edited');
    // The same text again is not saved twice.
    $this->postJson("{$url}/versions", ['label' => 'Edited', 'body' => 'First draft.'])->assertJsonPath('version', null);
    $first = withCompany($this->tenant, fn () => BidSectionVersion::sole());

    $this->patchJson($url, ['body' => 'Second draft, which went wrong.']);
    $this->postJson("{$url}/versions/{$first->id}/restore")
        ->assertJsonPath('section.body', 'First draft.')
        ->assertJsonPath('versions.0.label', 'Restored “Edited”')
        ->assertJsonPath('versions.1.label', 'Before restore')
        ->assertJsonPath('versions.1.body', 'Second draft, which went wrong.');

    $log = withCompany($this->tenant, fn () => AuditEvent::where('category', 'bid')->pluck('action')->all());
    expect($log)->toContain('changed a section’s status in', 'restored an earlier version in');
});

it('adds and removes sections', function () {
    decideToBid($this);

    $this->post("/tenders/{$this->tender->id}/sections", ['title' => 'Social value commitments'])->assertSessionHas('success');
    $added = sectionTitled($this->tenant, 'Social value commitments');
    expect($added->position)->toBe(3);

    $this->delete("/tenders/{$this->tender->id}/sections/{$added->id}")->assertSessionHas('success');
    expect(withCompany($this->tenant, fn () => BidSection::count()))->toBe(3);
});

it('lets viewers read the bid but not change it, and keeps other companies out', function () {
    decideToBid($this);
    $s = sectionTitled($this->tenant, 'Implementation plan');

    $viewer = User::factory()->create();
    $this->tenant->addMember($viewer, TenantRole::Viewer);
    $viewer->switchTenant($this->tenant);
    $this->actingAs($viewer)->get("/tenders/{$this->tender->id}/bid")->assertOk();
    $this->patchJson("/tenders/{$this->tender->id}/sections/{$s->id}", ['body' => 'x'])->assertForbidden();

    $rival = User::factory()->create();
    Tenant::factory()->ownedBy($rival)->create();
    $this->actingAs($rival)->get("/tenders/{$this->tender->id}/bid")->assertNotFound();
    $this->patchJson("/tenders/{$this->tender->id}/sections/{$s->id}", ['body' => 'x'])->assertNotFound();
});
