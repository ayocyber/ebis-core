<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Props every page receives. Tenant props are closures so they are read after
     * the route's `tenant` middleware has picked the current company.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'tenant' => function () {
                $tenant = app(CurrentTenant::class)->get();

                return $tenant ? ['id' => $tenant->id, 'name' => $tenant->name] : null;
            },
            'role' => function () use ($request) {
                $tenant = app(CurrentTenant::class)->get();

                return $tenant ? $request->user()?->roleIn($tenant)?->value : null;
            },
            'tenants' => fn () => $request->user()?->tenants
                ->map(fn ($t) => ['id' => $t->id, 'name' => $t->name, 'role' => $t->pivot->role->value])
                ->values() ?? [],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
