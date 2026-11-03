<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\CurrentTenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * For signed-in pages: pick the user's current company and scope every query to it.
 * Users with no company yet are sent to onboarding to create one.
 */
class SetCurrentTenant
{
    public function __construct(private CurrentTenant $current) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            return $next($request);
        }

        $tenant = $user->current_tenant_id
            ? $user->tenants()->whereKey($user->current_tenant_id)->first()
            : null;

        // Current company missing or no longer a membership: fall back to the first one.
        if ($tenant === null) {
            $tenant = $user->tenants()->first();
            $user->forceFill(['current_tenant_id' => $tenant?->getKey()])->save();
        }

        if ($tenant === null) {
            return $request->routeIs('onboarding.*')
                ? $next($request)
                : redirect()->route('onboarding.create');
        }

        $this->current->set($tenant);

        return $next($request);
    }
}
