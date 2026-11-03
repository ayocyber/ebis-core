<?php

namespace App\Models;

use App\Enums\TenantRole;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * A row in tenant_users: one person's membership of one company.
 *
 * @property string $tenant_id
 * @property int $user_id
 * @property TenantRole $role
 * @property Carbon|null $joined_at
 */
class TenantMember extends Pivot
{
    protected $table = 'tenant_users';

    public $incrementing = true;

    protected function casts(): array
    {
        return [
            'role' => TenantRole::class,
            'joined_at' => 'datetime',
        ];
    }
}
