<?php

use App\Enums\TenantRole;
use App\Models\Tenant;
use App\Models\User;

it('sends a user with no company to onboarding', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/dashboard')->assertRedirect('/onboarding');
});

it('shows the create company page', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/onboarding')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('onboarding/create-company')->where('isFirstCompany', true));
});

it('creates a company with the creator as owner and current company', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/onboarding', [
        'name' => 'Acme Facilities Ltd',
        'country' => 'GB',
        'time_zone' => 'Europe/London',
    ])->assertRedirect('/onboarding/evidence');

    $tenant = Tenant::sole();
    expect($tenant->name)->toBe('Acme Facilities Ltd')
        ->and($user->fresh()->current_tenant_id)->toBe($tenant->id)
        ->and($user->roleIn($tenant))->toBe(TenantRole::Owner);
});

it('validates the company details', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/onboarding', ['name' => '', 'country' => 'GBR', 'time_zone' => 'Mars/Base'])
        ->assertSessionHasErrors(['name', 'country', 'time_zone']);
});

it('shares the current company and role with every page', function () {
    $user = User::factory()->create();
    $tenant = Tenant::factory()->ownedBy($user)->create(['name' => 'Acme']);

    $this->actingAs($user)->get('/dashboard')
        ->assertInertia(fn ($page) => $page
            ->where('tenant.id', $tenant->id)
            ->where('tenant.name', 'Acme')
            ->where('role', 'owner')
            ->has('tenants', 1));
});

it('sends a user adding a second company back to the dashboard', function () {
    $user = User::factory()->create();
    Tenant::factory()->ownedBy($user)->create();

    $this->actingAs($user)->post('/onboarding', [
        'name' => 'Second Co Ltd',
        'country' => 'GB',
        'time_zone' => 'Europe/London',
    ])->assertRedirect('/dashboard');
});

it('shows the document upload step', function () {
    $user = User::factory()->create();
    Tenant::factory()->ownedBy($user)->create();

    $this->actingAs($user)->get('/onboarding/evidence')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('onboarding/evidence'));
});
