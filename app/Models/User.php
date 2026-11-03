<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\TenantRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string|null $current_tenant_id
 * @property-read TenantMember $pivot Present when loaded through Tenant::members()
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /** @return BelongsToMany<Tenant, $this, TenantMember> */
    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(Tenant::class, 'tenant_users')
            ->using(TenantMember::class)
            ->withPivot(['id', 'role', 'joined_at'])
            ->withTimestamps()
            ->orderBy('name');
    }

    /** @return BelongsTo<Tenant, $this> */
    public function currentTenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'current_tenant_id');
    }

    /** The user's role in a company, or null when they are not a member. */
    public function roleIn(Tenant|string $tenant): ?TenantRole
    {
        $tenantId = $tenant instanceof Tenant ? $tenant->getKey() : $tenant;

        return $this->tenants()->whereKey($tenantId)->first()?->pivot->role;
    }

    public function belongsToTenant(Tenant|string $tenant): bool
    {
        return $this->roleIn($tenant) !== null;
    }

    public function switchTenant(Tenant $tenant): void
    {
        $this->forceFill(['current_tenant_id' => $tenant->getKey()])->save();
    }
}
