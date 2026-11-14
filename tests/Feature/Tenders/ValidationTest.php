<?php

use App\Enums\TenantRole;
use App\Models\AuditEvent;
use App\Models\CompanyProfile;
use App\Models\Gap;
use App\Models\ReadinessCheck;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;

beforeEach(function () {
    $this->owner = User::factory()->create(['name' => 'Emma Richardson']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();

    $this->tender = asTheCompany($this->tenant, function () {
        CompanyProfile::factory()->create(['turnover' => [['year' => 'FY25', 'amount' => 1_500_000]]]);
        $tender = Tender::factory()->create(['deadline' => now()->addWeeks(6)->setTime(12, 0)]);
        Requirement::create([
            'tender_id' => $tender->id, 'code' => 'M-01', 'title' => 'Turnover 1m', 'text' => 'Turnover 1m', 'category' => 'mandatory',
            'topic' => 'financial', 'check_rule' => ['type' => 'turnover_min', 'amount' => 1_000_000], 'origin' => 'manual', 'confirmed_at' => now(),
        ]);

        return $tender;
    });
});

function asTheCompany(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

function proceedWithBid(object $test): void
{
    $test->actingAs($test->owner)->post("/tenders/{$test->tender->id}/eligibility");
    $gaps = asTheCompany($test->tenant, fn () => Gap::pluck('id')->all());
    $test->post("/tenders/{$test->tender->id}/decision", ['outcome' => 'proceed', 'acknowledged_blockers' => $gaps]);
}

it('opens after a decision to bid, with everything the readiness check needs', function () {
    $this->actingAs($this->owner)->get("/tenders/{$this->tender->id}/validation")->assertRedirect("/tenders/{$this->tender->id}/decision");

    proceedWithBid($this);
    $this->get("/tenders/{$this->tender->id}/validation")->assertInertia(fn ($page) => $page
        ->component('tenders/live/validation')
        ->has('rows', 1)
        ->has('sections', 1)
        ->where('decision.outcome', 'proceed')
        ->has('items')
        ->where('scoreHistory', [])
        ->where('signedOff', null));

    expect($this->tender->fresh()->stage->value)->toBe('validation');
});

it('keeps the score history: new results once, a re-check every time', function () {
    proceedWithBid($this);
    $url = "/tenders/{$this->tender->id}/readiness";

    $this->post($url, ['score' => 40, 'critical' => 3]);
    $this->post($url, ['score' => 40, 'critical' => 3]); // same result again: not kept twice
    $this->post($url, ['score' => 40, 'critical' => 3, 'manual' => true]); // pressed "check again"
    $this->post($url, ['score' => 140, 'critical' => 0])->assertSessionHasErrors('score');

    $history = asTheCompany($this->tenant, fn () => ReadinessCheck::orderBy('created_at')->orderBy('id')->get());
    expect($history)->toHaveCount(2)
        ->and($history[0]->by_name)->toBe('ProcurPilot')
        ->and($history[1]->by_name)->toBe('Emma Richardson');
});

it('signs off only when nothing critical is left, and logs it', function () {
    proceedWithBid($this);
    $this->post("/tenders/{$this->tender->id}/readiness", ['score' => 55, 'critical' => 2]);
    $this->post("/tenders/{$this->tender->id}/signoff")->assertSessionHasErrors('signoff');

    $this->post("/tenders/{$this->tender->id}/readiness", ['score' => 96, 'critical' => 0]);
    $this->post("/tenders/{$this->tender->id}/signoff")->assertSessionHas('success');

    $tender = $this->tender->fresh();
    expect($tender->stage->value)->toBe('submitted')
        ->and($tender->signed_off_by)->toBe($this->owner->id);

    // Results after sign-off are not added to the history.
    $this->post("/tenders/{$this->tender->id}/readiness", ['score' => 80, 'critical' => 1]);
    expect(asTheCompany($this->tenant, fn () => ReadinessCheck::count()))->toBe(2);

    $this->get("/tenders/{$this->tender->id}/validation")->assertInertia(fn ($page) => $page->where('signedOff.by', 'Emma Richardson'));

    $log = asTheCompany($this->tenant, fn () => AuditEvent::where('category', 'signoff')->sole());
    expect($log->action)->toBe('signed off the bid for')->and($log->detail)->toBe('Readiness 96%');
});

it('lets an owner withdraw the sign-off', function () {
    proceedWithBid($this);
    $this->post("/tenders/{$this->tender->id}/readiness", ['score' => 100, 'critical' => 0]);
    $this->post("/tenders/{$this->tender->id}/signoff");

    $this->delete("/tenders/{$this->tender->id}/signoff")->assertSessionHas('success');
    expect($this->tender->fresh()->signed_off_at)->toBeNull()
        ->and($this->tender->fresh()->stage->value)->toBe('validation');
});

it('lets only owners sign off, and keeps other companies out', function () {
    proceedWithBid($this);
    $this->post("/tenders/{$this->tender->id}/readiness", ['score' => 100, 'critical' => 0]);

    $editor = User::factory()->create();
    $this->tenant->addMember($editor, TenantRole::Editor);
    $editor->switchTenant($this->tenant);
    $this->actingAs($editor)->get("/tenders/{$this->tender->id}/validation")->assertOk();
    $this->post("/tenders/{$this->tender->id}/signoff")->assertForbidden();

    $rival = User::factory()->create();
    Tenant::factory()->ownedBy($rival)->create();
    $this->actingAs($rival)->get("/tenders/{$this->tender->id}/validation")->assertNotFound();
    $this->post("/tenders/{$this->tender->id}/readiness", ['score' => 1, 'critical' => 9])->assertNotFound();
    $this->post("/tenders/{$this->tender->id}/signoff")->assertNotFound();
});
