<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTenantRequest;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller
{
    public function edit(CurrentTenant $current): Response
    {
        $tenant = $current->require();

        return Inertia::render('settings/company', [
            'company' => $tenant->only(['id', 'name', 'country', 'time_zone']),
            'canManage' => Gate::allows('manage-tenant'),
        ]);
    }

    public function update(StoreTenantRequest $request, CurrentTenant $current): RedirectResponse
    {
        Gate::authorize('manage-tenant');

        $current->require()->update($request->validated());

        return back()->with('success', 'Company details saved.');
    }
}
