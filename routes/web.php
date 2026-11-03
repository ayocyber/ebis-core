<?php

use App\Http\Controllers\AcceptInvitationController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\TenantSwitchController;
use Illuminate\Support\Facades\Route;
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
    // Step 2 of setup: upload the documents tenders always ask for (frontend preview).
    Route::get('onboarding/evidence', function () {
        return Inertia::render('onboarding/evidence');
    })->name('onboarding.evidence');

    Route::post('tenants/{tenant}/switch', TenantSwitchController::class)->name('tenants.switch');

    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // Evidence vault & company profile — frontend preview on mock data.
    Route::get('vault', function () {
        return Inertia::render('vault/index');
    })->name('vault.index');

    Route::get('activity', function () {
        return Inertia::render('activity/index');
    })->name('activity.index');

    Route::get('company', function () {
        return Inertia::render('company/profile');
    })->name('company.profile');

    // Tenders — frontend preview on mock data until the tender API lands.
    Route::get('tenders', function () {
        return Inertia::render('tenders/index');
    })->name('tenders.index');

    Route::get('tenders/{tender}/eligibility', function (string $tender) {
        return Inertia::render('tenders/eligibility', ['tenderId' => $tender]);
    })->where('tender', '[A-Za-z0-9-]+')->name('tenders.eligibility');

    Route::get('tenders/{tender}/gaps', function (string $tender) {
        return Inertia::render('tenders/gaps', ['tenderId' => $tender]);
    })->where('tender', '[A-Za-z0-9-]+')->name('tenders.gaps');

    Route::get('tenders/{tender}/decision', function (string $tender) {
        return Inertia::render('tenders/decision', ['tenderId' => $tender]);
    })->where('tender', '[A-Za-z0-9-]+')->name('tenders.decision');

    Route::get('tenders/{tender}/compliance', function (string $tender) {
        return Inertia::render('tenders/compliance', ['tenderId' => $tender]);
    })->where('tender', '[A-Za-z0-9-]+')->name('tenders.compliance');

    Route::get('tenders/{tender}/bid', function (string $tender) {
        return Inertia::render('tenders/bid', ['tenderId' => $tender]);
    })->where('tender', '[A-Za-z0-9-]+')->name('tenders.bid');

    Route::get('tenders/{tender}/requirements', function (string $tender) {
        return Inertia::render('tenders/requirements', ['tenderId' => $tender]);
    })->where('tender', '[A-Za-z0-9-]+')->name('tenders.requirements');

    Route::get('tenders/{tender}/documents', function (string $tender) {
        return Inertia::render('tenders/documents', ['tenderId' => $tender]);
    })->where('tender', '[A-Za-z0-9-]+')->name('tenders.documents');

    Route::get('tenders/{tender}/validation', function (string $tender) {
        return Inertia::render('tenders/validation', ['tenderId' => $tender]);
    })->where('tender', '[A-Za-z0-9-]+')->name('tenders.validation');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
