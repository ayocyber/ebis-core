<?php

use App\Enums\TenderStage;
use App\Http\Controllers\AcceptInvitationController;
use App\Http\Controllers\ActivityController;
use App\Http\Controllers\CompanyProfileController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\TenantSwitchController;
use App\Http\Controllers\TenderController;
use App\Http\Controllers\VaultDocumentController;
use App\Models\AuditEvent;
use App\Models\Tender;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

// Invitation links work signed in or out.
Route::get('invitations/{token}', [AcceptInvitationController::class, 'show'])->name('invitations.show');

Route::middleware('auth')->group(function () {
    // Accepting is allowed before the person has any company of their own.
    Route::post('invitations/{token}/accept', [AcceptInvitationController::class, 'store'])->name('invitations.accept');
});

Route::middleware(['auth', 'tenant'])->group(function () {
    Route::get('onboarding', [OnboardingController::class, 'create'])->name('onboarding.create');
    Route::post('onboarding', [OnboardingController::class, 'store'])->name('onboarding.store');
    // Step 2 of setup: upload the documents tenders always ask for, straight into the vault.
    Route::get('onboarding/evidence', function () {
        return Inertia::render('onboarding/evidence');
    })->name('onboarding.evidence');

    Route::post('tenants/{tenant}/switch', TenantSwitchController::class)->name('tenants.switch');

    Route::get('dashboard', function () {
        return Inertia::render('dashboard', [
            'tenders' => Tender::with(['creator', 'documents' => fn ($q) => $q->withoutText()])
                ->where('stage', '!=', TenderStage::Submitted->value)
                ->orderBy('deadline')
                ->get()
                ->map->toFrontend()
                ->values(),
            'recentActivity' => AuditEvent::latest('id')->limit(5)->get()->map->toFrontend(),
        ]);
    })->name('dashboard');

    // M1: evidence vault, company profile and activity log.
    Route::get('vault', [VaultDocumentController::class, 'index'])->name('vault.index');
    Route::post('vault/documents', [VaultDocumentController::class, 'store'])->name('vault.store');
    Route::get('vault/documents/{document}/download', [VaultDocumentController::class, 'download'])
        ->whereUuid('document')->name('vault.download');
    Route::delete('vault/documents/{document}', [VaultDocumentController::class, 'destroy'])
        ->whereUuid('document')->name('vault.destroy');

    Route::get('company', [CompanyProfileController::class, 'show'])->name('company.profile');
    Route::patch('company', [CompanyProfileController::class, 'update'])->name('company.update');

    Route::get('activity', [ActivityController::class, 'index'])->name('activity.index');

    // M2: tender intake. Real tenders have UUIDs; the sample tenders (tnd-001…) keep
    // the stage pages below, which still run on sample data.
    Route::get('tenders', [TenderController::class, 'index'])->name('tenders.index');
    Route::post('tenders', [TenderController::class, 'store'])->name('tenders.store');
    Route::get('tenders/{tender}', [TenderController::class, 'show'])->whereUuid('tender')->name('tenders.show');
    Route::patch('tenders/{tender}', [TenderController::class, 'update'])->whereUuid('tender')->name('tenders.update');
    Route::delete('tenders/{tender}', [TenderController::class, 'destroy'])->whereUuid('tender')->name('tenders.destroy');
    Route::post('tenders/{tender}/documents', [TenderController::class, 'addDocuments'])
        ->whereUuid('tender')->name('tenders.documents.store');
    Route::get('tenders/{tender}/documents/{document}/download', [TenderController::class, 'download'])
        ->whereUuid(['tender', 'document'])->name('tenders.documents.download');
    Route::delete('tenders/{tender}/documents/{document}', [TenderController::class, 'destroyDocument'])
        ->whereUuid(['tender', 'document'])->name('tenders.documents.destroy');
    Route::post('tenders/{tender}/documents/{document}/retry', [TenderController::class, 'retryExtraction'])
        ->whereUuid(['tender', 'document'])->name('tenders.documents.retry');

    // Later stages: a preview on the sample tenders until M3–M7 land. Real tenders
    // (UUIDs) don't have these stages yet, so they go to their own page instead.
    foreach (['eligibility', 'gaps', 'decision', 'compliance', 'bid', 'requirements', 'documents', 'validation'] as $stage) {
        Route::get("tenders/{tender}/{$stage}", function (string $tender) use ($stage) {
            if (Str::isUuid($tender)) {
                return to_route('tenders.show', $tender);
            }

            return Inertia::render("tenders/{$stage}", ['tenderId' => $tender]);
        })->where('tender', '[A-Za-z0-9-]+')->name("tenders.{$stage}");
    }
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
