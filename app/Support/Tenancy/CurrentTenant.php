<?php

namespace App\Support\Tenancy;

use App\Models\Tenant;
use LogicException;

/**
 * Holds the company the current request (or queued job) works for.
 * Every tenant-owned model reads it through the BelongsToTenant scope.
 */
class CurrentTenant
{
    private ?Tenant $tenant = null;

    public function set(?Tenant $tenant): void
    {
        $this->tenant = $tenant;
    }

    public function get(): ?Tenant
    {
        return $this->tenant;
    }

    public function id(): ?string
    {
        return $this->tenant?->getKey();
    }

    public function require(): Tenant
    {
        return $this->tenant ?? throw new LogicException('No current tenant is set.');
    }

    /**
     * Run code as another tenant (queued jobs, console commands), then restore.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function runAs(Tenant $tenant, callable $callback): mixed
    {
        $previous = $this->tenant;
        $this->tenant = $tenant;

        try {
            return $callback();
        } finally {
            $this->tenant = $previous;
        }
    }
}
