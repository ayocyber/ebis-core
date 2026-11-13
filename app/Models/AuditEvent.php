<?php

namespace App\Models;

use App\Enums\AuditCategory;
use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use LogicException;

/**
 * EVD-05: one line in the activity log. Append-only: once written it can never be
 * changed or removed through the app. Write entries with App\Support\AuditLog.
 *
 * @property int $id
 * @property string $tenant_id
 * @property int|null $actor_id
 * @property string $actor_name
 * @property AuditCategory $category
 * @property string $action
 * @property string $target
 * @property string|null $tender_id
 * @property string|null $detail
 * @property string|null $subject_type
 * @property string|null $subject_id
 * @property Carbon $created_at
 */
class AuditEvent extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $fillable = ['actor_id', 'actor_name', 'category', 'action', 'target', 'tender_id', 'detail', 'subject_type', 'subject_id'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Audit events are append-only.'));
        static::deleting(fn () => throw new LogicException('Audit events are append-only.'));
    }

    protected function casts(): array
    {
        return [
            'category' => AuditCategory::class,
            'created_at' => 'datetime',
        ];
    }

    /**
     * Shape of `AuditEvent` in resources/js/hooks/use-audit.ts.
     *
     * @return array<string, string|null>
     */
    public function toFrontend(): array
    {
        return array_filter([
            'id' => (string) $this->id,
            'at' => $this->created_at->toIso8601ZuluString(),
            'by' => $this->actor_name,
            'category' => $this->category->value,
            'action' => $this->action,
            'target' => $this->target,
            'tenderId' => $this->tender_id,
            'detail' => $this->detail,
        ], fn ($v) => $v !== null);
    }
}
