<?php

use App\Models\CompanyProfile;
use App\Models\Tenant;
use App\Models\Tender;
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

it('adds two read demo tenders once, and does not bring deleted ones back', function () {
    Storage::fake('local');

    $this->seed(DemoSeeder::class);
    $tenant = Tenant::sole();
    $tenders = app(CurrentTenant::class)->runAs($tenant, fn () => Tender::with('documents')->orderBy('deadline')->get());

    expect($tenders)->toHaveCount(2)
        ->and($tenders[0]->reference)->toBe('ECC/ICT/2026/088')
        ->and($tenders[0]->stage->value)->toBe('requirements')
        ->and($tenders[0]->documents->every(fn ($d) => $d->extraction_status->value === 'done'))->toBeTrue();

    // The blank page in the selection questionnaire is reported, not skipped.
    $sq = $tenders[1]->documents->firstWhere('name', 'Selection questionnaire.pdf');
    expect($sq->extraction_status->value)->toBe('partial')->and($sq->unreadable_pages)->toBe([2]);

    // Running again (every deploy) adds nothing; deleted demo tenders stay deleted.
    $this->seed(DemoSeeder::class);
    app(CurrentTenant::class)->runAs($tenant, fn () => $tenders[0]->delete());
    $this->seed(DemoSeeder::class);

    expect(app(CurrentTenant::class)->runAs($tenant, fn () => Tender::count()))->toBe(1);
});
