<?php

use App\Models\CompanyProfile;
use App\Models\Tenant;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\Tenancy\CurrentTenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Support\Facades\Storage;

it('loads the demo company with its profile, vault files and members', function () {
    Storage::fake('local');

    $this->seed(DemoSeeder::class);

    $tenant = Tenant::sole();
    [$profile, $docs] = app(CurrentTenant::class)->runAs($tenant, fn () => [
        CompanyProfile::sole(),
        VaultDocument::with('facts')->get(),
    ]);

    expect($tenant->name)->toBe('Bluewave Networks Ltd')
        ->and($profile->employees)->toBe(42)
        ->and($docs)->toHaveCount(17)
        ->and($docs->every(fn ($d) => $d->facts->isNotEmpty()))->toBeTrue()
        ->and($docs->firstWhere('title', 'Cyber Essentials Plus')->facts->first()->key)->toBe('pf-cep');

    $doc = $docs->first();
    expect(Storage::disk('local')->get($doc->path))->toStartWith('%PDF-1.4')->toContain('%%EOF');

    $emma = User::where('email', 'emma@bluewave.example')->sole();
    $this->actingAs($emma)->get('/vault')->assertInertia(fn ($page) => $page->has('vault.documents', 17));
});
