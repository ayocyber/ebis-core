<?php

/*
| SEC-01: one company must never see or touch another company's data.
| Every tenant-owned model and route added later gets a case in this file.
*/

use App\Enums\AuditCategory;
use App\Enums\TenantRole;
use App\Models\Invitation;
use App\Models\Tenant;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\AuditLog;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->alice = User::factory()->create();
    $this->acme = Tenant::factory()->ownedBy($this->alice)->create();

    $this->bob = User::factory()->create();
    $this->globex = Tenant::factory()->ownedBy($this->bob)->create();

    $current = app(CurrentTenant::class);
    $this->acmeInvite = $current->runAs($this->acme, fn () => Invitation::create([
        'email' => 'a@example.com', 'role' => 'editor', 'token_hash' => Invitation::hashToken('a'),
        'invited_by' => $this->alice->id, 'expires_at' => now()->addDay(),
    ]));
    $this->globexInvite = $current->runAs($this->globex, fn () => Invitation::create([
        'email' => 'g@example.com', 'role' => 'editor', 'token_hash' => Invitation::hashToken('g'),
        'invited_by' => $this->bob->id, 'expires_at' => now()->addDay(),
    ]));
});

it('scopes queries to the current company', function () {
    $current = app(CurrentTenant::class);

    $acmeIds = $current->runAs($this->acme, fn () => Invitation::pluck('id')->all());
    $globexIds = $current->runAs($this->globex, fn () => Invitation::pluck('id')->all());

    expect($acmeIds)->toBe([$this->acmeInvite->id])
        ->and($globexIds)->toBe([$this->globexInvite->id]);
});

it('returns nothing when no company is set (fails closed)', function () {
    app(CurrentTenant::class)->set(null);

    expect(Invitation::count())->toBe(0);
});

it('stamps new records with the current company', function () {
    expect($this->acmeInvite->tenant_id)->toBe($this->acme->id);
});

it('does not list another company\'s invitations on the members page', function () {
    $this->actingAs($this->alice)->get('/settings/members')
        ->assertInertia(fn ($page) => $page
            ->has('invitations', 1)
            ->where('invitations.0.id', $this->acmeInvite->id));
});

it('answers 404 when cancelling another company\'s invitation', function () {
    $this->actingAs($this->alice)->delete("/settings/invitations/{$this->globexInvite->id}")->assertNotFound();

    expect(Invitation::withoutGlobalScope('tenant')->whereKey($this->globexInvite->id)->exists())->toBeTrue();
});

it('answers 404 when changing or removing a member of another company', function () {
    $this->actingAs($this->alice)->patch("/settings/members/{$this->bob->id}", ['role' => 'viewer'])->assertNotFound();
    $this->actingAs($this->alice)->delete("/settings/members/{$this->bob->id}")->assertNotFound();

    expect($this->bob->roleIn($this->globex))->toBe(TenantRole::Owner);
});

it('does not let a member of two companies act in one through the other', function () {
    // Alice is also a viewer at Globex, but her current company is Acme.
    $this->globex->addMember($this->alice, TenantRole::Viewer);

    $this->actingAs($this->alice)->delete("/settings/invitations/{$this->globexInvite->id}")->assertNotFound();
});

/*
| M1: company profile, evidence vault, activity log.
*/

it('does not show, download or delete another company\'s vault documents', function () {
    $current = app(CurrentTenant::class);
    $globexDoc = $current->runAs($this->globex, fn () => VaultDocument::factory()->create(['title' => 'Globex secret']));
    $current->runAs($this->acme, fn () => VaultDocument::factory()->create(['title' => 'Acme cert']));

    $this->actingAs($this->alice)->get('/vault')
        ->assertInertia(fn ($page) => $page->has('vault.documents', 1)->where('vault.documents.0.title', 'Acme cert'));
    $this->actingAs($this->alice)->get("/vault/documents/{$globexDoc->id}/download")->assertNotFound();
    $this->actingAs($this->alice)->delete("/vault/documents/{$globexDoc->id}")->assertNotFound();

    expect(VaultDocument::withoutGlobalScopes()->find($globexDoc->id)->trashed())->toBeFalse();
});

it('does not let an upload replace another company\'s document', function () {
    Storage::fake('local');
    $globexDoc = app(CurrentTenant::class)->runAs($this->globex, fn () => VaultDocument::factory()->create());

    $this->actingAs($this->alice)->post('/vault/documents', [
        'file' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf'),
        'title' => 'Sneaky', 'category' => 'other', 'replaces_id' => $globexDoc->id,
    ])->assertNotFound();

    expect(VaultDocument::withoutGlobalScopes()->find($globexDoc->id)->archived_at)->toBeNull();
});

it('keeps company profiles and activity logs separate', function () {
    $current = app(CurrentTenant::class);
    $current->runAs($this->globex, fn () => AuditLog::record(AuditCategory::Profile, 'updated the company profile', 'Globex only'));

    $this->actingAs($this->bob)->patch('/company', ['legalName' => 'Globex Corp', 'employees' => 900]);

    $this->actingAs($this->alice)->get('/company')
        ->assertInertia(fn ($page) => $page->where('profile.legalName', $this->acme->name)->where('profile.employees', 0));
    $this->actingAs($this->alice)->get('/activity')
        ->assertInertia(fn ($page) => $page->has('activity', 0));
});
