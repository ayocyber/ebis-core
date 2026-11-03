<?php

namespace App\Http\Controllers;

use App\Enums\TenantRole;
use App\Http\Requests\StoreTenantRequest;
use App\Models\Tenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * First run: a signed-in user with no company creates one and becomes its Owner.
 * Also used later to add another company (consultants helping several SMEs).
 */
class OnboardingController extends Controller
{
    public function create(Request $request): Response
    {
        return Inertia::render('onboarding/create-company', [
            'isFirstCompany' => $request->user()->tenants()->doesntExist(),
        ]);
    }

    public function store(StoreTenantRequest $request): RedirectResponse
    {
        $user = $request->user();

        $isFirstCompany = $user->tenants()->doesntExist();

        DB::transaction(function () use ($request, $user) {
            $tenant = Tenant::create([
                ...$request->validated(),
                'created_by' => $user->getKey(),
            ]);
            $tenant->addMember($user, TenantRole::Owner);
            $user->switchTenant($tenant);
        });

        // A brand-new company goes on to upload its core documents (step 2 of setup).
        return $isFirstCompany
            ? redirect()->route('onboarding.evidence')->with('success', 'Company created.')
            : redirect()->route('dashboard')->with('success', 'Company created.');
    }
}
