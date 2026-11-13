<?php

use App\Enums\TenantRole;
use App\Models\Assessment;
use App\Models\AuditEvent;
use App\Models\CompanyProfile;
use App\Models\EligibilityRun;
use App\Models\Gap;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\Tenancy\CurrentTenant;

beforeEach(function () {
    $this->owner = User::factory()->create(['name' => 'Emma Richardson']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();

    inCompany($this->tenant, function () {
        CompanyProfile::factory()->create([
            'incorporated_at' => '2013-03-14',
            'turnover' => [['year' => 'FY23', 'amount' => 1_310_000], ['year' => 'FY24', 'amount' => 1_580_000], ['year' => 'FY25', 'amount' => 1_910_000]],
            'insurance' => [['label' => 'Public liability', 'cover' => 5_000_000], ['label' => 'Employer’s liability', 'cover' => 10_000_000]],
        ]);
        VaultDocument::factory()->create(['title' => 'Public liability insurance', 'category' => 'insurance']);
        // Runs out before the tender deadline (EVD-02).
        VaultDocument::factory()->create(['title' => 'Cyber Essentials Plus', 'expires_at' => now()->addWeek()->toDateString()]);
        VaultDocument::factory()->create(['title' => 'Case study — Riverside NHS', 'category' => 'experience']);

        $this->tender = Tender::factory()->create(['deadline' => now()->addWeeks(4)->setTime(12, 0)]);
        $rules = [
            'Turnover 900k' => ['type' => 'turnover_min', 'amount' => 900_000, 'years' => 2],
            'Turnover 2m' => ['type' => 'turnover_min', 'amount' => 2_000_000],
            'Public liability 5m' => ['type' => 'insurance_min', 'kind' => 'public', 'amount' => 5_000_000],
            'Employer’s liability 10m' => ['type' => 'insurance_min', 'kind' => 'employers', 'amount' => 10_000_000],
            'Cyber Essentials Plus' => ['type' => 'certification', 'name' => 'Cyber Essentials Plus'],
            'ISO 14001' => ['type' => 'certification', 'name' => 'ISO 14001'],
            'Trading 3 years' => ['type' => 'years_trading', 'years' => 3],
            'Two case studies' => ['type' => 'vault_documents', 'category' => 'experience', 'count' => 2],
            'Method statement' => null,
        ];
        $n = 0;
        foreach ($rules as $title => $rule) {
            Requirement::create([
                'tender_id' => $this->tender->id, 'code' => sprintf('M-%02d', ++$n), 'title' => $title, 'text' => $title,
                'category' => 'mandatory', 'topic' => 'technical', 'check_rule' => $rule, 'origin' => 'manual', 'confirmed_at' => now(),
            ]);
        }
    });
});

function inCompany(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

/** @return array<string, Assessment> keyed by requirement title */
function latestResults(Tenant $tenant): array
{
    return inCompany($tenant, fn () => EligibilityRun::latest('created_at')->latest('id')->firstOrFail()
        ->assessments()->with('requirement')->get()->keyBy(fn ($a) => $a->requirement->title)->all());
}

it('checks every requirement by its rule, without guessing', function () {
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility")
        ->assertRedirect("/tenders/{$this->tender->id}/eligibility")
        ->assertSessionHas('success', 'Eligibility checked: Does not qualify yet.');

    $r = latestResults($this->tenant);
    expect($r['Turnover 900k']->status->value)->toBe('met')
        ->and($r['Turnover 2m']->status->value)->toBe('not_met')
        ->and($r['Turnover 2m']->reasoning)->toContain('FY25: £1,910,000')
        ->and($r['Public liability 5m']->status->value)->toBe('met')
        // Cover is in the profile, but no certificate in the vault proves it.
        ->and($r['Employer’s liability 10m']->status->value)->toBe('partially_met')
        // Expires before the deadline: only partly met, and flagged as stale (EVD-02).
        ->and($r['Cyber Essentials Plus']->status->value)->toBe('partially_met')
        ->and($r['Cyber Essentials Plus']->stale['factLabel'])->toBe('Cyber Essentials Plus')
        // Missing data is Unknown, never assumed (ELG-03).
        ->and($r['ISO 14001']->status->value)->toBe('unknown')
        ->and($r['Trading 3 years']->status->value)->toBe('met')
        ->and($r['Two case studies']->status->value)->toBe('partially_met')
        ->and($r['Method statement']->status->value)->toBe('unknown')
        ->and($r['Method statement']->method)->toBe('user');

    $run = inCompany($this->tenant, fn () => EligibilityRun::sole());
    expect($run->verdict)->toBe('does_not_qualify')
        ->and($run->score)->toBe(50) // (3 met + 3 partial × 0.5) / 9
        ->and($run->tender_version)->toBe(1)
        ->and($run->profile_version)->toBe(1)
        ->and($this->tender->fresh()->stage->value)->toBe('eligibility');
});

it('makes a gap for everything not met, with a remedy, and a blocker when it can’t close in time', function () {
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility");

    $gaps = inCompany($this->tenant, fn () => Gap::with('requirement')->get()->keyBy(fn ($g) => $g->requirement->title));
    expect($gaps)->toHaveCount(6)
        ->and($gaps->has('Turnover 900k'))->toBeFalse()
        // ISO certification takes ~60 working days; the deadline is ~20 away.
        ->and($gaps['ISO 14001']->severity->value)->toBe('blocker')
        ->and($gaps['ISO 14001']->remedy)->toContain('two to three months')
        ->and($gaps['Cyber Essentials Plus']->severity->value)->toBe('fixable')
        ->and($gaps['Cyber Essentials Plus']->remedy)->toContain('Renew');
});

it('closes a gap when the evidence arrives, and keeps the user’s call while the requirement is unchanged', function () {
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility");
    $judgement = latestResults($this->tenant)['Method statement'];

    $this->post("/tenders/{$this->tender->id}/assessments/{$judgement->id}/override", ['status' => 'met', 'reason' => 'We have a template that fits.'])
        ->assertSessionHas('success');
    expect($judgement->fresh()->override['previousStatus'])->toBe('unknown');

    inCompany($this->tenant, fn () => VaultDocument::factory()->create(['title' => 'ISO 14001:2015']));
    $this->get("/tenders/{$this->tender->id}/eligibility")->assertInertia(fn ($page) => $page->where('run.outdated', true));

    $this->post("/tenders/{$this->tender->id}/eligibility");
    $r = latestResults($this->tenant);
    expect($r['ISO 14001']->status->value)->toBe('met')
        ->and($r['Method statement']->status->value)->toBe('met')
        ->and($r['Method statement']->override['reason'])->toBe('We have a template that fits.');

    $iso = inCompany($this->tenant, fn () => Gap::whereHas('requirement', fn ($q) => $q->where('title', 'ISO 14001'))->sole());
    expect($iso->status)->toBe('closed');

    // Editing the requirement means the old call no longer applies.
    $req = $r['Method statement']->requirement;
    $this->patch("/tenders/{$this->tender->id}/requirements/{$req->id}", [
        'title' => 'Method statement', 'text' => 'Now with a 3-page limit', 'category' => 'mandatory', 'topic' => 'technical',
    ]);
    $this->post("/tenders/{$this->tender->id}/eligibility");
    expect(latestResults($this->tenant)['Method statement']->status->value)->toBe('unknown');
});

it('logs the run and every override', function () {
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility");
    $a = latestResults($this->tenant)['Turnover 2m'];
    $this->post("/tenders/{$this->tender->id}/assessments/{$a->id}/override", ['status' => 'partially_met', 'reason' => 'Parent company guarantee agreed.']);
    $this->post("/tenders/{$this->tender->id}/assessments/{$a->id}/override", ['status' => 'met'])->assertSessionHasErrors('reason');

    $events = inCompany($this->tenant, fn () => AuditEvent::orderBy('id')->get());
    expect($events->pluck('action')->all())->toBe(['ran the eligibility check for', 'overrode the result for'])
        ->and($events[1]->detail)->toBe('Not met → Partially met · “Parent company guarantee agreed.”')
        ->and($events[1]->tender_id)->toBe($this->tender->id);
});

it('shows the page and only lets the latest run be changed', function () {
    $this->actingAs($this->owner)->get("/tenders/{$this->tender->id}/eligibility")->assertInertia(fn ($page) => $page
        ->component('tenders/live/eligibility')->where('run', null)->where('confirmedCount', 9));

    $this->post("/tenders/{$this->tender->id}/eligibility");
    $old = latestResults($this->tenant)['Turnover 2m'];
    $this->post("/tenders/{$this->tender->id}/eligibility");

    $this->get("/tenders/{$this->tender->id}/eligibility")->assertInertia(fn ($page) => $page
        ->has('rows', 9)
        ->where('run.verdict', 'does_not_qualify')
        ->where('run.outdated', false)
        ->where('rows.0.assessment.method', 'rule'));

    $this->post("/tenders/{$this->tender->id}/assessments/{$old->id}/override", ['status' => 'met', 'reason' => 'Old run'])->assertNotFound();
});

it('needs confirmed requirements, and keeps viewers and other companies out', function () {
    inCompany($this->tenant, fn () => Requirement::query()->update(['confirmed_at' => null]));
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility")->assertSessionHasErrors('requirements');

    $viewer = User::factory()->create();
    $this->tenant->addMember($viewer, TenantRole::Viewer);
    $viewer->switchTenant($this->tenant);
    $this->actingAs($viewer)->get("/tenders/{$this->tender->id}/eligibility")->assertOk();
    $this->post("/tenders/{$this->tender->id}/eligibility")->assertForbidden();

    $rival = User::factory()->create();
    Tenant::factory()->ownedBy($rival)->create();
    $this->actingAs($rival)->get("/tenders/{$this->tender->id}/eligibility")->assertNotFound();
    $this->post("/tenders/{$this->tender->id}/eligibility")->assertNotFound();
});
