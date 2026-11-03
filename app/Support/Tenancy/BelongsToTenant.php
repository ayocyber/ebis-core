<?php

namespace App\Support\Tenancy;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Add to every model that belongs to one company (SEC-01).
 *
 * - Every query is filtered to the current tenant.
 * - With no current tenant, queries return nothing (fail closed, never everything).
 * - tenant_id is filled in automatically on create.
 *
 * Use withoutGlobalScope('tenant') only in admin code that is meant to see all tenants.
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $query) {
            $tenantId = app(CurrentTenant::class)->id();
            $column = $query->getModel()->qualifyColumn('tenant_id');

            $tenantId === null
                ? $query->whereRaw('1 = 0')
                : $query->where($column, $tenantId);
        });

        static::creating(function ($model) {
            $model->tenant_id ??= app(CurrentTenant::class)->require()->getKey();
        });
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
