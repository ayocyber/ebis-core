<?php

namespace App\Models;

use App\Enums\TenantRole;
use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string $tenant_id
 * @property string $email
 * @property TenantRole $role
 * @property string $token_hash
 * @property int|null $invited_by
 * @property Carbon $expires_at
 * @property Carbon|null $accepted_at
 */
class Invitation extends Model
{
    use BelongsToTenant, HasUuids;

    public const VALID_DAYS = 7;

    protected $fillable = ['email', 'role', 'token_hash', 'invited_by', 'expires_at'];

    protected function casts(): array
    {
        return [
            'role' => TenantRole::class,
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    /** @param Builder<Invitation> $query */
    public function scopePending(Builder $query): void
    {
        $query->whereNull('accepted_at')->where('expires_at', '>', now());
    }

    public function isPending(): bool
    {
        return $this->accepted_at === null && $this->expires_at->isFuture();
    }

    public static function newToken(): string
    {
        return Str::random(48);
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Find an invitation by its emailed token, across all tenants
     * (the person accepting is not a member of the tenant yet).
     */
    public static function findByToken(string $token): ?self
    {
        return static::withoutGlobalScope('tenant')
            ->where('token_hash', static::hashToken($token))
            ->first();
    }
}
