<?php

namespace App\Providers;

use App\Enums\TenantRole;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // One per request (and reset between queued jobs).
        $this->app->scoped(CurrentTenant::class);
    }

    public function boot(): void
    {
        Model::preventLazyLoading(! $this->app->isProduction());
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

        // Abilities inside the current company (spec section 3).
        Gate::define('edit-tenant-data', fn (User $user) => $this->currentRole($user)?->canEdit() ?? false);
        Gate::define('manage-tenant', fn (User $user) => $this->currentRole($user)?->isOwner() ?? false);

        // SEC: limits that stop one account (or one address) overloading the server.
        $who = fn (Request $request) => $request->user()?->getAuthIdentifier() ?? $request->ip();
        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(30)->by('up:'.$who($request)));
        RateLimiter::for('exports', fn (Request $request) => Limit::perMinute(10)->by('ex:'.$who($request)));
        RateLimiter::for('forms', fn (Request $request) => Limit::perMinute(6)->by('form:'.$request->ip()));
    }

    private function currentRole(User $user): ?TenantRole
    {
        $tenant = $this->app->make(CurrentTenant::class)->get();

        return $tenant ? $user->roleIn($tenant) : null;
    }
}
