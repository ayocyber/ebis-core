<?php

use App\Enums\AuditCategory;
use App\Enums\TenantRole;
use App\Models\AuditEvent;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\AuditLog;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
    $this->owner = User::factory()->create(['name' => 'Emma Richardson']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create(['name' => 'Bluewave Networks']);

    insideCompany($this->tenant, function () {
        Storage::disk('local')->put("tenants/{$this->tenant->id}/vault/iso.pdf", '%PDF iso');
        VaultDocument::factory()->create(['title' => 'ISO 9001', 'file_name' => 'ISO 9001.pdf', 'path' => "tenants/{$this->tenant->id}/vault/iso.pdf"]);
        Storage::disk('local')->put("tenants/{$this->tenant->id}/vault/old.pdf", '%PDF old');
        VaultDocument::factory()->create(['title' => 'Old insurance', 'file_name' => 'Old.pdf', 'path' => "tenants/{$this->tenant->id}/vault/old.pdf"])->delete();
        Tender::factory()->create(['title' => 'Network services']);
    });
});

function insideCompany(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

/** @return array<string, string> */
function zipEntries(string $path): array
{
    $zip = new ZipArchive;
    $zip->open($path);
    $entries = [];
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $entries[(string) $zip->getNameIndex($i)] = (string) $zip->getFromIndex($i);
    }
    $zip->close();

    return $entries;
}

it('lets an owner download every record and file the company holds', function () {
    $response = $this->actingAs($this->owner)->get('/settings/company/data')->assertOk();
    expect($response->headers->get('content-disposition'))->toContain('Bluewave-Networks_ProcurPilot-data_');

    $entries = zipEntries($response->baseResponse->getFile()->getPathname());
    expect($entries)->toHaveKeys(['README.txt', 'data/company.json', 'data/tenders.json', 'data/vault_documents.json', 'data/activity_log.json'])
        ->and($entries['files/vault/ISO 9001.pdf'])->toBe('%PDF iso')
        ->and($entries['files/vault/Old.pdf'])->toBe('%PDF old'); // deleted but still held: included

    $company = json_decode($entries['data/company.json'], true);
    expect($company['name'])->toBe('Bluewave Networks')
        ->and($company['members'][0]['email'])->toBe($this->owner->email);
    expect(json_decode($entries['data/tenders.json'], true)[0]['title'])->toBe('Network services')
        ->and(json_decode($entries['data/vault_documents.json'], true))->toHaveCount(2);

    expect(insideCompany($this->tenant, fn () => AuditEvent::where('action', 'downloaded all company data')->count()))->toBe(1);
});

it('never puts another company’s data in the export', function () {
    $rival = User::factory()->create();
    $other = Tenant::factory()->ownedBy($rival)->create(['name' => 'Rival Ltd']);
    insideCompany($other, fn () => Tender::factory()->create(['title' => 'Rival tender']));

    $entries = zipEntries($this->actingAs($this->owner)->get('/settings/company/data')->baseResponse->getFile()->getPathname());
    expect(collect($entries)->implode(''))->not->toContain('Rival tender')->not->toContain('Rival Ltd');
});

it('lets only owners download or delete the company', function () {
    $editor = User::factory()->create();
    $this->tenant->addMember($editor, TenantRole::Editor);
    $editor->switchTenant($this->tenant);

    $this->actingAs($editor)->get('/settings/company/data')->assertForbidden();
    $this->delete('/settings/company', ['confirm_name' => 'Bluewave Networks', 'password' => 'password'])->assertForbidden();
    expect(Tenant::find($this->tenant->id))->not->toBeNull();
});

it('deletes the company, every row and every file, once the owner confirms', function () {
    $editor = User::factory()->create();
    $this->tenant->addMember($editor, TenantRole::Editor);
    $editor->switchTenant($this->tenant);

    $this->actingAs($this->owner)->delete('/settings/company', ['confirm_name' => 'Bluewave', 'password' => 'password'])
        ->assertSessionHasErrors('confirm_name');
    $this->delete('/settings/company', ['confirm_name' => 'Bluewave Networks', 'password' => 'wrong'])->assertSessionHasErrors('password');
    expect(Tenant::find($this->tenant->id))->not->toBeNull();

    $this->delete('/settings/company', ['confirm_name' => 'Bluewave Networks', 'password' => 'password'])->assertRedirect(route('dashboard'));

    expect(Tenant::withTrashed()->find($this->tenant->id))->toBeNull()
        ->and(DB::table('tenders')->where('tenant_id', $this->tenant->id)->count())->toBe(0)
        ->and(DB::table('vault_documents')->where('tenant_id', $this->tenant->id)->count())->toBe(0)
        ->and(DB::table('audit_events')->where('tenant_id', $this->tenant->id)->count())->toBe(0)
        ->and(DB::table('tenant_users')->where('tenant_id', $this->tenant->id)->count())->toBe(0)
        ->and(Storage::disk('local')->allFiles("tenants/{$this->tenant->id}"))->toBe([]);

    // Members keep their sign-in and are sent to set up a company.
    expect($editor->fresh())->not->toBeNull()->and($editor->fresh()->current_tenant_id)->toBeNull();
    $this->actingAs($editor->fresh())->get('/dashboard')->assertRedirect(route('onboarding.create'));
});

it('gives anyone their own data as JSON', function () {
    $this->actingAs($this->owner);
    insideCompany($this->tenant, fn () => AuditLog::record(AuditCategory::Tender, 'added', 'Network services'));

    $data = $this->get('/settings/profile/data')->assertOk()->assertHeader('content-type', 'application/json')->json();
    expect($data['account']['email'])->toBe($this->owner->email)
        ->and($data['account'])->not->toHaveKey('password')
        ->and($data['companies'][0]['name'])->toBe('Bluewave Networks')
        ->and($data['activity']['Bluewave Networks'][0]['action'])->toBe('added');
});

it('will not delete the only owner of a company that has other members', function () {
    $editor = User::factory()->create();
    $this->tenant->addMember($editor, TenantRole::Editor);

    $this->actingAs($this->owner)->delete('/settings/profile', ['password' => 'password'])->assertSessionHasErrors('password');
    expect($this->owner->fresh())->not->toBeNull();
});

it('deletes a company with its only member, so nothing is left behind', function () {
    $this->actingAs($this->owner)->delete('/settings/profile', ['password' => 'password'])->assertRedirect('/');

    expect($this->owner->fresh())->toBeNull()
        ->and(Tenant::withTrashed()->find($this->tenant->id))->toBeNull()
        ->and(Storage::disk('local')->allFiles("tenants/{$this->tenant->id}"))->toBe([]);
});

it('erases what was deleted more than 30 days ago, files included', function () {
    $old = insideCompany($this->tenant, fn () => VaultDocument::onlyTrashed()->sole());
    $this->artisan('privacy:purge-deleted')->assertSuccessful();
    expect(VaultDocument::withoutGlobalScope('tenant')->withTrashed()->find($old->id))->not->toBeNull(); // only just deleted

    $this->travel(31)->days();
    $this->artisan('privacy:purge-deleted')->expectsOutput('Erased 1 deleted item.')->assertSuccessful();

    expect(VaultDocument::withoutGlobalScope('tenant')->withTrashed()->find($old->id))->toBeNull()
        ->and(Storage::disk('local')->exists($old->path))->toBeFalse()
        ->and(Storage::disk('local')->exists("tenants/{$this->tenant->id}/vault/iso.pdf"))->toBeTrue();
});
