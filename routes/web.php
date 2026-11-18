<?php

use App\Enums\TenderStage;
use App\Http\Controllers\AcceptInvitationController;
use App\Http\Controllers\ActivityController;
use App\Http\Controllers\BidController;
use App\Http\Controllers\ChecklistController;
use App\Http\Controllers\CompanyProfileController;
use App\Http\Controllers\EligibilityController;
use App\Http\Controllers\GapDecisionController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\OpportunityController;
use App\Http\Controllers\RequirementController;
use App\Http\Controllers\TenantSwitchController;
use App\Http\Controllers\TenderController;
use App\Http\Controllers\ValidationController;
use App\Http\Controllers\VaultDocumentController;
use App\Models\AuditEvent;
use App\Models\ReadinessCheck;
use App\Models\Tender;
use App\Models\TenderDecision;
use App\Models\User;
use App\Support\Eligibility\EligibilityRunner;
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
    Route::post('invitations/{token}/accept', [AcceptInvitationController::class, 'store'])->middleware('throttle:forms')->name('invitations.accept');
});

Route::middleware(['auth', 'tenant', 'own-tender'])->group(function () {
    Route::get('onboarding', [OnboardingController::class, 'create'])->name('onboarding.create');
    Route::post('onboarding', [OnboardingController::class, 'store'])->name('onboarding.store');
    // Step 2 of setup: upload the documents tenders always ask for, straight into the vault.
    Route::get('onboarding/evidence', function () {
        return Inertia::render('onboarding/evidence');
    })->name('onboarding.evidence');

    Route::post('tenants/{tenant}/switch', TenantSwitchController::class)->name('tenants.switch');

    Route::get('dashboard', function (EligibilityRunner $runner) {
        $tenders = Tender::with(['creator', 'documents' => fn ($q) => $q->withoutText()])
            ->where('stage', '!=', TenderStage::Submitted->value)
            ->orderBy('deadline')
            ->get();

        return Inertia::render('dashboard', [
            'tenders' => $tenders->map->toFrontend()->values(),
            // Each tender's latest eligibility rows and decision, so gaps and go / no-go
            // on the dashboard come from real data.
            'workspaces' => $tenders->mapWithKeys(function (Tender $t) use ($runner) {
                $run = $runner->latestRun($t);
                $decision = TenderDecision::with('decider')->where('tender_id', $t->id)->latest('created_at')->latest('id')->first();
                $readiness = ReadinessCheck::where('tender_id', $t->id)->latest('created_at')->latest('id')->value('score');
                $signer = $t->signed_off_by !== null ? User::find($t->signed_off_by) : null;

                return [$t->id => [
                    'rows' => $run ? $runner->rows($run) : [],
                    'decision' => $decision?->toFrontend(),
                    'readiness' => $readiness,
                    'signedOff' => $t->signed_off_at ? ['by' => $signer->name ?? 'Former member', 'at' => $t->signed_off_at->toIso8601ZuluString()] : null,
                ]];
            }),
            'recentActivity' => AuditEvent::latest('id')->limit(5)->get()->map->toFrontend(),
        ]);
    })->name('dashboard');

    // M1: evidence vault, company profile and activity log.
    Route::get('vault', [VaultDocumentController::class, 'index'])->name('vault.index');
    Route::post('vault/documents', [VaultDocumentController::class, 'store'])->middleware('throttle:uploads')->name('vault.store');
    Route::post('vault/read', [VaultDocumentController::class, 'read'])->middleware('throttle:uploads')->name('vault.read');
    Route::get('vault/documents/{document}/download', [VaultDocumentController::class, 'download'])
        ->whereUuid('document')->name('vault.download');
    Route::delete('vault/documents/{document}', [VaultDocumentController::class, 'destroy'])
        ->whereUuid('document')->name('vault.destroy');
    Route::post('vault/documents/{document}/check', [VaultDocumentController::class, 'check'])
        ->whereUuid('document')->name('vault.check');

    // Check the company's details against the Companies House register.
    Route::post('company/verify', [CompanyProfileController::class, 'verify'])->middleware('throttle:uploads')->name('company.verify');

    Route::get('company', [CompanyProfileController::class, 'show'])->name('company.profile');
    Route::patch('company', [CompanyProfileController::class, 'update'])->name('company.update');

    Route::get('activity', [ActivityController::class, 'index'])->name('activity.index');

    // M2: tender intake. Real tenders have UUIDs; the sample tenders (tnd-001…) keep
    // the stage pages below, which still run on sample data.
    Route::get('tenders', [TenderController::class, 'index'])->name('tenders.index');
    // Open tenders from Find a Tender and Contracts Finder.
    Route::get('tenders/find', [OpportunityController::class, 'index'])->name('opportunities.index');
    Route::put('tenders/find/keywords', [OpportunityController::class, 'keywords'])->name('opportunities.keywords');
    Route::post('tenders/find/{opportunity}/bid', [OpportunityController::class, 'bid'])->whereUuid('opportunity')->middleware('throttle:uploads')->name('opportunities.bid');
    Route::post('tenders', [TenderController::class, 'store'])->middleware('throttle:uploads')->name('tenders.store');
    Route::get('tenders/{tender}', [TenderController::class, 'show'])->whereUuid('tender')->name('tenders.show');
    Route::patch('tenders/{tender}', [TenderController::class, 'update'])->whereUuid('tender')->name('tenders.update');
    Route::delete('tenders/{tender}', [TenderController::class, 'destroy'])->whereUuid('tender')->name('tenders.destroy');
    Route::post('tenders/{tender}/documents', [TenderController::class, 'addDocuments'])
        ->whereUuid('tender')->middleware('throttle:uploads')->name('tenders.documents.store');
    Route::get('tenders/{tender}/documents/{document}/download', [TenderController::class, 'download'])
        ->whereUuid(['tender', 'document'])->name('tenders.documents.download');
    Route::delete('tenders/{tender}/documents/{document}', [TenderController::class, 'destroyDocument'])
        ->whereUuid(['tender', 'document'])->name('tenders.documents.destroy');
    Route::post('tenders/{tender}/documents/{document}/retry', [TenderController::class, 'retryExtraction'])
        ->whereUuid(['tender', 'document'])->name('tenders.documents.retry');

    // Requirements of a real tender (TUN-01/02/03).
    Route::post('tenders/{tender}/requirements', [RequirementController::class, 'store'])
        ->whereUuid('tender')->name('tenders.requirements.store');
    Route::post('tenders/{tender}/requirements/confirm/{requirement?}', [RequirementController::class, 'confirm'])
        ->whereUuid(['tender', 'requirement'])->name('tenders.requirements.confirm');
    Route::patch('tenders/{tender}/requirements/{requirement}', [RequirementController::class, 'update'])
        ->whereUuid(['tender', 'requirement'])->name('tenders.requirements.update');
    Route::delete('tenders/{tender}/requirements/{requirement}', [RequirementController::class, 'destroy'])
        ->whereUuid(['tender', 'requirement'])->name('tenders.requirements.destroy');

    // Eligibility check of a real tender (M4).
    Route::post('tenders/{tender}/eligibility', [EligibilityController::class, 'run'])
        ->whereUuid('tender')->name('tenders.eligibility.run');
    Route::post('tenders/{tender}/assessments/{assessment}/override', [EligibilityController::class, 'override'])
        ->whereUuid(['tender', 'assessment'])->name('tenders.assessments.override');
    Route::post('tenders/{tender}/assessments/{assessment}/review', [EligibilityController::class, 'review'])
        ->whereUuid(['tender', 'assessment'])->name('tenders.assessments.review');

    // Gaps and go / no-go of a real tender (M5).
    Route::patch('tenders/{tender}/gaps/{gap}', [GapDecisionController::class, 'updateGap'])
        ->whereUuid(['tender', 'gap'])->name('tenders.gaps.update');
    Route::post('tenders/{tender}/decision', [GapDecisionController::class, 'decide'])
        ->whereUuid('tender')->name('tenders.decision.store');

    // The written bid of a real tender (M6): sections, mapping, versions.
    Route::post('tenders/{tender}/sections', [BidController::class, 'storeSection'])
        ->whereUuid('tender')->name('tenders.sections.store');
    Route::patch('tenders/{tender}/sections/{section}', [BidController::class, 'updateSection'])
        ->whereUuid(['tender', 'section'])->name('tenders.sections.update');
    Route::delete('tenders/{tender}/sections/{section}', [BidController::class, 'destroySection'])
        ->whereUuid(['tender', 'section'])->name('tenders.sections.destroy');
    Route::post('tenders/{tender}/sections/{section}/versions', [BidController::class, 'saveVersion'])
        ->whereUuid(['tender', 'section'])->name('tenders.sections.versions.store');
    Route::post('tenders/{tender}/sections/{section}/versions/{version}/restore', [BidController::class, 'restore'])
        ->whereUuid(['tender', 'section', 'version'])->name('tenders.sections.versions.restore');
    Route::post('tenders/{tender}/compliance/map', [BidController::class, 'map'])
        ->whereUuid('tender')->name('tenders.compliance.map');

    // Documents checklist of a real tender (M6, BID-02/06).
    Route::patch('tenders/{tender}/checklist/{item}', [ChecklistController::class, 'update'])
        ->whereUuid(['tender', 'item'])->name('tenders.checklist.update');
    Route::post('tenders/{tender}/checklist/{item}/file', [ChecklistController::class, 'upload'])
        ->whereUuid(['tender', 'item'])->middleware('throttle:uploads')->name('tenders.checklist.upload');
    Route::get('tenders/{tender}/checklist/{item}/file', [ChecklistController::class, 'download'])
        ->whereUuid(['tender', 'item'])->name('tenders.checklist.download');
    Route::post('tenders/{tender}/checklist/{item}/form', [ChecklistController::class, 'form'])
        ->whereUuid(['tender', 'item'])->middleware('throttle:exports')->name('tenders.checklist.form');

    // Readiness and sign-off of a real tender (M7).
    Route::post('tenders/{tender}/readiness', [ValidationController::class, 'record'])
        ->whereUuid('tender')->name('tenders.readiness.store');
    Route::post('tenders/{tender}/signoff', [ValidationController::class, 'signOff'])
        ->whereUuid('tender')->name('tenders.signoff.store');
    Route::delete('tenders/{tender}/signoff', [ValidationController::class, 'undoSignOff'])
        ->whereUuid('tender')->name('tenders.signoff.destroy');
    Route::get('tenders/{tender}/pack', [ValidationController::class, 'pack'])
        ->whereUuid('tender')->middleware('throttle:exports')->name('tenders.pack');

    // Stage pages. Sample tenders (tnd-001…) show the preview built on sample data.
    // Real tenders (UUIDs) use the real page.
    $real = [
        'requirements' => [RequirementController::class, 'index'],
        'eligibility' => [EligibilityController::class, 'index'],
        'gaps' => [GapDecisionController::class, 'gaps'],
        'decision' => [GapDecisionController::class, 'decision'],
        'compliance' => [BidController::class, 'compliance'],
        'bid' => [BidController::class, 'bid'],
        'documents' => [ChecklistController::class, 'index'],
        'validation' => [ValidationController::class, 'index'],
    ];
    foreach ($real as $stage => [$controller, $method]) {
        Route::get("tenders/{tender}/{$stage}", function (string $tender) use ($stage, $controller, $method) {
            if (Str::isUuid($tender)) {
                return app()->call([app($controller), $method], ['tender' => $tender]);
            }

            return Inertia::render("tenders/{$stage}", ['tenderId' => $tender]);
        })->where('tender', '[A-Za-z0-9-]+')->name("tenders.{$stage}");
    }
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
