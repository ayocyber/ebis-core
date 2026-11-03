<?php

use App\Enums\TenantRole;
use App\Models\Tenant;
use App\Models\User;

it('switches to another company the user belongs to', function () {
    $user = User::factory()->create();
    Tenant::factory()->ownedBy($user)->create();
    $second = Tenant::factory()->create();
    $second->addMember($user, TenantRole::Viewer);

    $this->actingAs($user)->post("/tenants/{$second->id}/switch")->assertRedirect('/dashboard');

    expect($user->fresh()->current_tenant_id)->toBe($second->id);
});

it('answers 404 when switching to a company the user is not in', function () {
    $user = User::factory()->create();
    Tenant::factory()->ownedBy($user)->create();
    $other = Tenant::factory()->create();

    $this->actingAs($user)->post("/tenants/{$other->id}/switch")->assertNotFound();
});

it('falls back to another membership when the current company is gone', function () {
    $user = User::factory()->create();
    $first = Tenant::factory()->ownedBy($user)->create();
    $second = Tenant::factory()->create();
    $second->addMember($user, TenantRole::Editor);

    $first->members()->detach($user->id);

    $this->actingAs($user)->get('/dashboard')->assertOk();
    expect($user->fresh()->current_tenant_id)->toBe($second->id);
});
