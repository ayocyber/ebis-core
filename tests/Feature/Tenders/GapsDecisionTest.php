<?php

use App\Enums\TenantRole;
use App\Models\AuditEvent;
use App\Models\CompanyProfile;
use App\Models\Gap;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\TenderDecision;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;

beforeEach(function () {
    $this->owner = User::factory()->create(['name' => 'Emma Richardson']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();

    $this->tender = forCompany($this->tenant, function () {
        CompanyProfile::factory()->create(['turnover' => [['year' => 'FY25', 'amount' => 1_500_000]]]);
        $tender = Tender::factory()->create(['deadline' => now()->addWeeks(4)->setTime(12, 0)]);
        foreach ([
            ['M-01', 'Turnover 1m', ['type' => 'turnover_min', 'amount' => 1_000_000]],
            ['M-02', 'ISO 9001', ['type' => 'certification', 'name' => 'ISO 9001']],
            ['M-03', 'Method statement', null],
        ] as [$code, $title, $rule]) {
            Requirement::create([
                'tender_id' => $tender->id, 'code' => $code, 'title' => $title, 'text' => $title, 'category' => 'mandatory',
                'topic' => 'technical', 'check_rule' => $rule, 'origin' => 'manual', 'confirmed_at' => now(),
            ]);
        }

        return $tender;
    });
});

function forCompany(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

function gapFor(Tenant $tenant, string $title): Gap
{
    return forCompany($tenant, fn () => Gap::whereHas('requirement', fn ($q) => $q->where('title', $title))->sole());
}

it('needs an eligibility check before gaps and the decision', function () {
    $this->actingAs($this->owner)->get("/tenders/{$this->tender->id}/gaps")
        ->assertRedirect("/tenders/{$this->tender->id}/eligibility")->assertSessionHas('error');
    $this->get("/tenders/{$this->tender->id}/decision")->assertRedirect("/tenders/{$this->tender->id}/eligibility");
});

it('shows the gap plan for the latest check', function () {
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility");

    $this->get("/tenders/{$this->tender->id}/gaps")->assertInertia(fn ($page) => $page
        ->component('tenders/live/gaps')
        ->has('rows', 3)
        ->where('rows.1.gap.severity', 'blocker')
        ->where('rows.1.gap.evidence.category', 'certificate'));
});

it('tracks gap progress and logs each change', function () {
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility");
    $gap = gapFor($this->tenant, 'Method statement');

    $this->patch("/tenders/{$this->tender->id}/gaps/{$gap->id}", ['status' => 'in_progress', 'owner' => 'Kemi Adebayo'])->assertSessionHas('success');
    $this->patch("/tenders/{$this->tender->id}/gaps/{$gap->id}", ['status' => 'closed']);
    $this->patch("/tenders/{$this->tender->id}/gaps/{$gap->id}", ['status' => 'done'])->assertSessionHasErrors('status');

    $gap->refresh();
    expect($gap->status)->toBe('closed')->and($gap->owner)->toBe('Kemi Adebayo')->and($gap->status_changed_by)->toBe($this->owner->id);

    $events = forCompany($this->tenant, fn () => AuditEvent::where('category', 'gap')->orderBy('id')->get());
    expect($events->pluck('detail')->all())->toBe(['Open → In progress · owner Kemi Adebayo', 'In progress → Closed · owner Kemi Adebayo'])
        ->and($events[1]->action)->toBe('closed the gap');

    // A gap the user closed stays closed when the check runs again.
    $this->post("/tenders/{$this->tender->id}/eligibility");
    expect($gap->fresh()->status)->toBe('closed');
});

it('records a decision to bid only once every open mandatory gap is accepted', function () {
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility");
    $iso = gapFor($this->tenant, 'ISO 9001');
    $method = gapFor($this->tenant, 'Method statement');

    $this->post("/tenders/{$this->tender->id}/decision", ['outcome' => 'proceed', 'acknowledged_blockers' => [$iso->id]])
        ->assertSessionHasErrors('acknowledged_blockers');
    expect(forCompany($this->tenant, fn () => TenderDecision::count()))->toBe(0);

    $this->post("/tenders/{$this->tender->id}/decision", [
        'outcome' => 'proceed',
        'reason' => 'Certification is booked for next week.',
        'acknowledged_blockers' => [$iso->id, $method->id],
        'conditions' => ['ISO 9001 by Fri 4 Dec'],
    ])->assertSessionHas('success', 'Decision recorded: bid.');

    expect($this->tender->fresh()->stage->value)->toBe('compliance');
    $this->get("/tenders/{$this->tender->id}/decision")->assertInertia(fn ($page) => $page
        ->component('tenders/live/decision')
        ->where('decision.outcome', 'proceed')
        ->where('decision.decidedBy', 'Emma Richardson')
        ->where('decision.conditions', ['ISO 9001 by Fri 4 Dec']));

    $log = forCompany($this->tenant, fn () => AuditEvent::where('category', 'decision')->sole());
    expect($log->action)->toBe('decided to bid for')
        ->and($log->detail)->toBe('“Certification is booked for next week.” · 2 open gaps accepted as conditions');
});

it('keeps every decision; the latest one counts', function () {
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility");
    $this->post("/tenders/{$this->tender->id}/decision", ['outcome' => 'decline', 'reason' => 'Too risky without ISO 9001.']);
    expect($this->tender->fresh()->stage->value)->toBe('decision');

    $gaps = forCompany($this->tenant, fn () => Gap::pluck('id')->all());
    $this->post("/tenders/{$this->tender->id}/decision", ['outcome' => 'proceed', 'acknowledged_blockers' => $gaps]);

    expect(forCompany($this->tenant, fn () => TenderDecision::count()))->toBe(2);
    $this->get("/tenders/{$this->tender->id}/decision")->assertInertia(fn ($page) => $page->where('decision.outcome', 'proceed'));
});

it('lets only owners decide, editors update gaps, and keeps other companies out', function () {
    $this->actingAs($this->owner)->post("/tenders/{$this->tender->id}/eligibility");
    $gap = gapFor($this->tenant, 'ISO 9001');

    $editor = User::factory()->create();
    $this->tenant->addMember($editor, TenantRole::Editor);
    $editor->switchTenant($this->tenant);
    $this->actingAs($editor)->patch("/tenders/{$this->tender->id}/gaps/{$gap->id}", ['status' => 'in_progress'])->assertSessionHas('success');
    $this->post("/tenders/{$this->tender->id}/decision", ['outcome' => 'decline'])->assertForbidden();

    $viewer = User::factory()->create();
    $this->tenant->addMember($viewer, TenantRole::Viewer);
    $viewer->switchTenant($this->tenant);
    $this->actingAs($viewer)->get("/tenders/{$this->tender->id}/gaps")->assertOk();
    $this->patch("/tenders/{$this->tender->id}/gaps/{$gap->id}", ['status' => 'closed'])->assertForbidden();

    $rival = User::factory()->create();
    Tenant::factory()->ownedBy($rival)->create();
    $this->actingAs($rival)->get("/tenders/{$this->tender->id}/gaps")->assertNotFound();
    $this->patch("/tenders/{$this->tender->id}/gaps/{$gap->id}", ['status' => 'closed'])->assertNotFound();
    $this->post("/tenders/{$this->tender->id}/decision", ['outcome' => 'decline'])->assertNotFound();
});
