<?php

use App\Enums\AuditCategory;
use App\Models\AuditEvent;
use App\Models\Tenant;
use App\Models\User;
use App\Support\AuditLog;
use App\Support\Tenancy\CurrentTenant;

beforeEach(function () {
    $this->owner = User::factory()->create(['name' => 'James Oliver']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();
    $this->event = app(CurrentTenant::class)->runAs($this->tenant, fn () => AuditLog::record(
        AuditCategory::Profile, 'updated the company profile', 'Employees', 'Employees 38 → 42', actor: $this->owner,
    ));
});

it('lists the log newest first in the frontend shape', function () {
    app(CurrentTenant::class)->runAs($this->tenant, fn () => AuditLog::record(AuditCategory::Vault, 'flagged an expired document', 'ISO 9001'));

    $this->actingAs($this->owner)->get('/activity')
        ->assertInertia(fn ($page) => $page->component('activity/index')
            ->has('activity', 2)
            ->where('activity.0.by', 'ProcurPilot')
            ->where('activity.0.category', 'vault')
            ->where('activity.1.by', 'James Oliver')
            ->where('activity.1.detail', 'Employees 38 → 42')
            ->missing('activity.1.tenderId'));
});

it('shows the latest entries on the dashboard', function () {
    $this->actingAs($this->owner)->get('/dashboard')
        ->assertInertia(fn ($page) => $page->has('recentActivity', 1));
});

it('is append-only', function () {
    expect(fn () => $this->event->update(['action' => 'something else']))->toThrow(LogicException::class)
        ->and(fn () => $this->event->delete())->toThrow(LogicException::class)
        ->and(AuditEvent::withoutGlobalScopes()->sole()->action)->toBe('updated the company profile');
});

it('keeps long targets within the 255-character columns', function () {
    // Postgres refuses longer text; a long tender reference plus title once broke "Bid for this".
    $event = app(CurrentTenant::class)->runAs($this->tenant, fn () => AuditLog::record(
        AuditCategory::Documents, str_repeat('a', 300), str_repeat('t', 300),
    ));

    expect(mb_strlen($event->action))->toBeLessThanOrEqual(255)
        ->and(mb_strlen($event->target))->toBeLessThanOrEqual(255);
});
