<?php

use App\Enums\TenantRole;
use App\Models\AuditEvent;
use App\Models\ProfileFact;
use App\Models\Tenant;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
    $this->owner = User::factory()->create(['name' => 'Emma Richardson']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();
});

function vaultUpload(array $overrides = []): array
{
    return [
        'file' => UploadedFile::fake()->create('Cyber Essentials Plus.pdf', 240, 'application/pdf'),
        'title' => 'Cyber Essentials Plus',
        'category' => 'certificate',
        'issuer' => 'IASME Consortium',
        'reference' => 'IASME-CEP-018842',
        'issued_at' => now()->subMonth()->toDateString(),
        'expires_at' => now()->addMonths(11)->toDateString(),
        'fact_keys' => ['pf-cep'],
        ...$overrides,
    ];
}

function asTenant(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

it('stores an upload privately with a verified fact and a log entry', function () {
    $this->actingAs($this->owner)->post('/vault/documents', vaultUpload())->assertSessionHas('success');

    $doc = asTenant($this->tenant, fn () => VaultDocument::with('facts')->sole());
    expect($doc->title)->toBe('Cyber Essentials Plus')
        ->and($doc->kind)->toBe('pdf')
        ->and($doc->sha256)->toHaveLength(64)
        ->and($doc->path)->toStartWith("tenants/{$this->tenant->id}/vault/");
    Storage::disk('local')->assertExists($doc->path);

    $fact = $doc->facts->sole();
    expect($fact->key)->toBe('pf-cep')
        ->and($fact->value)->toBe('IASME-CEP-018842')
        ->and($fact->verification()->value)->toBe('verified')
        ->and($fact->expires_at->toDateString())->toBe($doc->expires_at->toDateString());

    $event = asTenant($this->tenant, fn () => AuditEvent::sole());
    expect($event->actor_name)->toBe('Emma Richardson')
        ->and($event->action)->toBe('added to the evidence vault')
        ->and($event->target)->toBe('Cyber Essentials Plus');
});

it('shares the vault with every page in the frontend shape', function () {
    $this->actingAs($this->owner)->post('/vault/documents', vaultUpload());

    $this->actingAs($this->owner)->get('/vault')
        ->assertInertia(fn ($page) => $page->component('vault/index')
            ->has('vault.documents', 1)
            ->where('vault.documents.0.title', 'Cyber Essentials Plus')
            ->where('vault.documents.0.factIds', ['pf-cep'])
            ->where('vault.documents.0.uploadedBy', 'Emma Richardson')
            ->where('vault.documents.0.issuer', 'IASME Consortium'));
});

it('creates an unkeyed fact when the upload names none (every document proves something)', function () {
    $this->actingAs($this->owner)->post('/vault/documents', vaultUpload(['fact_keys' => null]));

    $fact = asTenant($this->tenant, fn () => ProfileFact::sole());
    expect($fact->key)->toBeNull()->and($fact->vault_document_id)->not->toBeNull();
});

it('rejects the wrong file type, oversize files and expired documents', function () {
    $this->actingAs($this->owner)
        ->post('/vault/documents', vaultUpload(['file' => UploadedFile::fake()->create('virus.exe', 10)]))
        ->assertSessionHasErrors(['file' => 'Use a PDF, Word document or image.']);

    $this->actingAs($this->owner)
        ->post('/vault/documents', vaultUpload(['file' => UploadedFile::fake()->create('big.pdf', 26 * 1024, 'application/pdf')]))
        ->assertSessionHasErrors('file');

    $this->actingAs($this->owner)
        ->post('/vault/documents', vaultUpload(['expires_at' => now()->subDay()->toDateString()]))
        ->assertSessionHasErrors('expires_at');

    expect(asTenant($this->tenant, fn () => VaultDocument::count()))->toBe(0);
});

it('archives the old version on renewal and carries its facts over', function () {
    $this->actingAs($this->owner)->post('/vault/documents', vaultUpload(['expires_at' => now()->addDays(10)->toDateString()]));
    $old = asTenant($this->tenant, fn () => VaultDocument::sole());

    $this->actingAs($this->owner)->post('/vault/documents', vaultUpload([
        'replaces_id' => $old->id, 'fact_keys' => null, 'expires_at' => now()->addYear()->toDateString(),
    ]))->assertSessionHas('success');

    [$current, $all] = asTenant($this->tenant, fn () => [VaultDocument::current()->with('facts')->sole(), VaultDocument::count()]);
    expect($all)->toBe(2)
        ->and($current->replaces_id)->toBe($old->id)
        ->and($current->facts->pluck('key')->all())->toBe(['pf-cep'])
        ->and(VaultDocument::withoutGlobalScopes()->find($old->id)->archived_at)->not->toBeNull();

    $this->actingAs($this->owner)->get('/vault')->assertInertia(fn ($page) => $page->has('vault.documents', 1));
});

it('soft-deletes so past evidence survives, and logs it', function () {
    $this->actingAs($this->owner)->post('/vault/documents', vaultUpload());
    $doc = asTenant($this->tenant, fn () => VaultDocument::sole());

    $this->actingAs($this->owner)->delete("/vault/documents/{$doc->id}")->assertSessionHas('success');

    expect(VaultDocument::withoutGlobalScopes()->withTrashed()->find($doc->id)->trashed())->toBeTrue();
    Storage::disk('local')->assertExists($doc->path);
    expect(asTenant($this->tenant, fn () => AuditEvent::latest('id')->first()->action))->toBe('deleted from the evidence vault');
});

it('downloads a file with its original name', function () {
    $this->actingAs($this->owner)->post('/vault/documents', vaultUpload());
    $doc = asTenant($this->tenant, fn () => VaultDocument::sole());

    $this->actingAs($this->owner)->get("/vault/documents/{$doc->id}/download")
        ->assertOk()
        ->assertDownload('Cyber Essentials Plus.pdf');
});

it('lets viewers look and download but not upload or delete', function () {
    $this->actingAs($this->owner)->post('/vault/documents', vaultUpload());
    $doc = asTenant($this->tenant, fn () => VaultDocument::sole());

    $viewer = User::factory()->create();
    $this->tenant->addMember($viewer, TenantRole::Viewer);
    $viewer->switchTenant($this->tenant);

    $this->actingAs($viewer)->get('/vault')->assertOk();
    $this->actingAs($viewer)->get("/vault/documents/{$doc->id}/download")->assertOk();
    $this->actingAs($viewer)->post('/vault/documents', vaultUpload())->assertForbidden();
    $this->actingAs($viewer)->delete("/vault/documents/{$doc->id}")->assertForbidden();
});
