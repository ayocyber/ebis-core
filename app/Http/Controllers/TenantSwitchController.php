<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class TenantSwitchController extends Controller
{
    public function __invoke(Request $request, string $tenant): RedirectResponse
    {
        $user = $request->user();
        $target = $user->tenants()->whereKey($tenant)->first();

        // Not a member: answer as if the company does not exist.
        abort_if($target === null, 404);

        /** @var Tenant $target */
        $user->switchTenant($target);

        return redirect()->route('dashboard')->with('success', "Switched to {$target->name}.");
    }
}
