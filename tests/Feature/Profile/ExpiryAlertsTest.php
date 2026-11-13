<?php

use App\Enums\TenantRole;
use App\Models\AuditEvent;
use App\Models\Tenant;
use App\Models\User;
use App\Models\VaultDocument;
use App\Notifications\DocumentExpiring;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Notification::fake();
    $this->owner = User::factory()->create();
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();
    $this->editor = User::factory()->create();
    $this->viewer = User::factory()->create();
    $this->tenant->addMember($this->editor, TenantRole::Editor);
    $this->tenant->addMember($this->viewer, TenantRole::Viewer);
});

function expiringDoc(Tenant $tenant, int $days, array $state = []): VaultDocument
{
    return app(CurrentTenant::class)->runAs($tenant, fn () => VaultDocument::factory()->expiresInDays($days)->create($state));
}

it('emails owners and editors at 90 days, once, and logs it as ProcurPilot', function () {
    expiringDoc($this->tenant, 85, ['title' => 'ISO 9001']);

    $this->artisan('vault:expiry-alerts')->assertSuccessful();
    $this->artisan('vault:expiry-alerts')->assertSuccessful();

    Notification::assertSentTo([$this->owner, $this->editor], DocumentExpiring::class, fn ($n) => $n->days === 85);
    Notification::assertNotSentTo($this->viewer, DocumentExpiring::class);
    Notification::assertSentTimes(DocumentExpiring::class, 2);

    $event = app(CurrentTenant::class)->runAs($this->tenant, fn () => AuditEvent::sole());
    expect($event->actor_name)->toBe('ProcurPilot')
        ->and($event->action)->toBe('sent a 90-day renewal reminder for')
        ->and($event->target)->toBe('ISO 9001');
});

it('sends the 30-day reminder after the 90-day one', function () {
    expiringDoc($this->tenant, 20, ['alerted_90_at' => now()->subMonths(2)]);

    $this->artisan('vault:expiry-alerts');

    Notification::assertSentTo($this->owner, DocumentExpiring::class, fn ($n) => $n->days === 20);
});

it('ignores far-off, expired and archived documents', function () {
    expiringDoc($this->tenant, 200);
    expiringDoc($this->tenant, -3);
    expiringDoc($this->tenant, 10)->forceFill(['archived_at' => now()])->save();

    $this->artisan('vault:expiry-alerts');

    Notification::assertNothingSent();
});
