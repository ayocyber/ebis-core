<?php

use App\Enums\TenantRole;
use App\Models\Invitation;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\TenantInvitation;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();
});

function memberWithRole(Tenant $tenant, TenantRole $role): User
{
    $user = User::factory()->create();
    $tenant->addMember($user, $role);
    $user->switchTenant($tenant);

    return $user;
}

it('lists members and pending invitations', function () {
    memberWithRole($this->tenant, TenantRole::Editor);

    $this->actingAs($this->owner)->get('/settings/members')
        ->assertInertia(fn ($page) => $page->component('settings/members')
            ->has('members', 2)
            ->where('canManage', true));
});

it('lets an owner invite someone and emails them a link', function () {
    Notification::fake();

    $this->actingAs($this->owner)
        ->post('/settings/invitations', ['email' => 'Jane@Example.com', 'role' => 'editor'])
        ->assertSessionHas('success');

    $invitation = Invitation::withoutGlobalScope('tenant')->sole();
    expect($invitation->email)->toBe('jane@example.com')
        ->and($invitation->tenant_id)->toBe($this->tenant->id)
        ->and($invitation->role)->toBe(TenantRole::Editor);

    Notification::assertSentOnDemand(TenantInvitation::class);
});

it('does not let editors or viewers invite, change roles or remove people', function (TenantRole $role) {
    $user = memberWithRole($this->tenant, $role);

    $this->actingAs($user)->post('/settings/invitations', ['email' => 'x@example.com', 'role' => 'viewer'])->assertForbidden();
    $this->actingAs($user)->patch("/settings/members/{$this->owner->id}", ['role' => 'viewer'])->assertForbidden();
    $this->actingAs($user)->delete("/settings/members/{$this->owner->id}")->assertForbidden();
})->with([TenantRole::Editor, TenantRole::Viewer]);

it('changes a member role', function () {
    $editor = memberWithRole($this->tenant, TenantRole::Editor);

    $this->actingAs($this->owner)->patch("/settings/members/{$editor->id}", ['role' => 'viewer']);

    expect($editor->roleIn($this->tenant))->toBe(TenantRole::Viewer);
});

it('never leaves a company without an owner', function () {
    $this->actingAs($this->owner)->patch("/settings/members/{$this->owner->id}", ['role' => 'editor'])
        ->assertSessionHas('error');
    $this->actingAs($this->owner)->delete("/settings/members/{$this->owner->id}")
        ->assertSessionHas('error');

    expect($this->owner->roleIn($this->tenant))->toBe(TenantRole::Owner);
});

it('removes a member', function () {
    $viewer = memberWithRole($this->tenant, TenantRole::Viewer);

    $this->actingAs($this->owner)->delete("/settings/members/{$viewer->id}");

    expect($viewer->roleIn($this->tenant))->toBeNull()
        ->and($viewer->fresh()->current_tenant_id)->toBeNull();
});

it('lets an owner rename the company but not a viewer', function () {
    $viewer = memberWithRole($this->tenant, TenantRole::Viewer);
    $data = ['name' => 'New Name Ltd', 'country' => 'GB', 'time_zone' => 'Europe/London'];

    $this->actingAs($viewer)->patch('/settings/company', $data)->assertForbidden();
    $this->actingAs($this->owner)->patch('/settings/company', $data)->assertSessionHas('success');

    expect($this->tenant->fresh()->name)->toBe('New Name Ltd');
});
