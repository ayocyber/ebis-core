<?php

namespace App\Providers;

use App\Enums\TenantRole;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;
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
    }

    private function currentRole(User $user): ?TenantRole
    {
        $tenant = $this->app->make(CurrentTenant::class)->get();

        return $tenant ? $user->roleIn($tenant) : null;
    }
}
