<?php

namespace App\Models;

use App\Enums\TenantRole;
use Carbon\Carbon;
use Database\Factories\TenantFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A customer company. Everything a company owns carries its tenant_id.
 *
 * @property string $id
 * @property string $name
 * @property string $country
 * @property string $time_zone
 * @property string $data_region
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property-read TenantMember $pivot Present when loaded through User::tenants()
 */
class Tenant extends Model
{
    /** @use HasFactory<TenantFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = ['name', 'country', 'time_zone', 'data_region', 'created_by'];

    /** @return BelongsToMany<User, $this, TenantMember> */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'tenant_users')
            ->using(TenantMember::class)
            ->withPivot(['id', 'role', 'joined_at'])
            ->withTimestamps();
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function addMember(User $user, TenantRole $role): void
    {
        $this->members()->syncWithoutDetaching([
            $user->getKey() => ['role' => $role->value, 'joined_at' => now()],
        ]);
    }

    public function ownersCount(): int
    {
        return $this->members()->wherePivot('role', TenantRole::Owner->value)->count();
    }
}
