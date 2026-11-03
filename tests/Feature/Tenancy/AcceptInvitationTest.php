<?php

use App\Enums\TenantRole;
use App\Models\Invitation;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Carbon\CarbonInterface;

function inviteTo(Tenant $tenant, string $email, TenantRole $role = TenantRole::Editor, ?CarbonInterface $expires = null): string
{
    $token = Invitation::newToken();

    app(CurrentTenant::class)->runAs($tenant, fn () => Invitation::create([
        'email' => $email,
        'role' => $role->value,
        'token_hash' => Invitation::hashToken($token),
        'invited_by' => $tenant->created_by,
        'expires_at' => $expires ?? now()->addDays(7),
    ]));

    return $token;
}

beforeEach(function () {
    $this->tenant = Tenant::factory()->ownedBy(User::factory()->create())->create(['name' => 'Acme']);
});

it('shows the invitation to a guest and remembers where to come back', function () {
    $token = inviteTo($this->tenant, 'jane@example.com');

    $this->get("/invitations/{$token}")
        ->assertInertia(fn ($page) => $page->component('invitations/accept')
            ->where('invitation.company', 'Acme')
            ->where('invitation.email', 'jane@example.com'))
        ->assertSessionHas('url.intended');
});

it('adds the invited user to the company with the invited role', function () {
    $token = inviteTo($this->tenant, 'jane@example.com', TenantRole::Viewer);
    $jane = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($jane)->post("/invitations/{$token}/accept")->assertRedirect('/dashboard');

    expect($jane->roleIn($this->tenant))->toBe(TenantRole::Viewer)
        ->and($jane->fresh()->current_tenant_id)->toBe($this->tenant->id);
});

it('refuses an invitation meant for another email', function () {
    $token = inviteTo($this->tenant, 'jane@example.com');
    $bob = User::factory()->create(['email' => 'bob@example.com']);

    $this->actingAs($bob)->post("/invitations/{$token}/accept")->assertSessionHas('error');

    expect($bob->roleIn($this->tenant))->toBeNull();
});

it('refuses expired and already-used invitations', function () {
    $expired = inviteTo($this->tenant, 'jane@example.com', expires: now()->subMinute());
    $jane = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($jane)->post("/invitations/{$expired}/accept")->assertSessionHas('error');
    expect($jane->roleIn($this->tenant))->toBeNull();

    $token = inviteTo($this->tenant, 'jane@example.com');
    $this->actingAs($jane)->post("/invitations/{$token}/accept");
    $this->actingAs($jane)->post("/invitations/{$token}/accept")->assertSessionHas('error');
});

it('shows nothing for an unknown token', function () {
    $this->get('/invitations/not-a-real-token')
        ->assertInertia(fn ($page) => $page->where('invitation', null));
});
