<?php

use App\Enums\TenantRole;
use App\Models\AuditEvent;
use App\Models\CompanyProfile;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->owner = User::factory()->create(['name' => 'Grace Lee']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create(['name' => 'Bluewave Networks Ltd']);
});

it('starts a profile from the company name', function () {
    $this->actingAs($this->owner)->get('/company')
        ->assertInertia(fn ($page) => $page->component('company/profile')
            ->where('profile.legalName', 'Bluewave Networks Ltd')
            ->where('profile.turnover', [])
            ->where('profile.version', 1));
});

it('saves a new version, keeps a snapshot and logs what changed', function () {
    $this->actingAs($this->owner)->patch('/company', [
        'legalName' => 'Bluewave Networks Ltd',
        'employees' => 42,
        'engineers' => 38,
        'vatNumber' => 'GB 184 5520 31',
        'turnover' => [['year' => 'FY25', 'amount' => 1_910_000]],
    ])->assertSessionHas('success', 'Company profile saved.');

    $profile = app(CurrentTenant::class)->runAs($this->tenant, fn () => CompanyProfile::sole());
    expect($profile->version)->toBe(2)
        ->and($profile->employees)->toBe(42)
        ->and($profile->turnover)->toBe([['year' => 'FY25', 'amount' => 1_910_000]]);

    $snapshot = json_decode(DB::table('company_profile_versions')->where('version', 2)->value('data'), true);
    expect($snapshot['employees'])->toBe(42);

    $event = app(CurrentTenant::class)->runAs($this->tenant, fn () => AuditEvent::sole());
    expect($event->actor_name)->toBe('Grace Lee')
        ->and($event->detail)->toContain('Employees 0 → 42')
        ->and($event->detail)->toContain('Turnover changed')
        ->and($event->detail)->toContain('version 2');
});

it('does not bump the version or log when nothing changed', function () {
    $this->actingAs($this->owner)->patch('/company', ['legalName' => 'Bluewave Networks Ltd'])
        ->assertSessionHas('success', 'No changes to save.');

    expect(app(CurrentTenant::class)->runAs($this->tenant, fn () => [CompanyProfile::sole()->version, AuditEvent::count()]))
        ->toBe([1, 0]);
});

it('validates the numbers', function () {
    $this->actingAs($this->owner)->patch('/company', ['employees' => 5, 'engineers' => 9])
        ->assertSessionHasErrors('engineers');
    $this->actingAs($this->owner)->patch('/company', ['legalName' => ''])
        ->assertSessionHasErrors('legalName');
});

it('does not let viewers edit the profile', function () {
    $viewer = User::factory()->create();
    $this->tenant->addMember($viewer, TenantRole::Viewer);
    $viewer->switchTenant($this->tenant);

    $this->actingAs($viewer)->get('/company')->assertOk();
    $this->actingAs($viewer)->patch('/company', ['employees' => 1])->assertForbidden();
});
