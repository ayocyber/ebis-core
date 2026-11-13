<?php

namespace App\Models;

use App\Enums\GapSeverity;
use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Something to fix before bidding (GAP-01…05). One per requirement; its progress
 * survives re-running the check, and it closes itself when the requirement is met.
 *
 * @property string $id
 * @property string $tender_id
 * @property string $requirement_id
 * @property GapSeverity $severity
 * @property string $title
 * @property string $description
 * @property string $remedy
 * @property int $time_to_close_days
 * @property string $status
 * @property string|null $owner
 * @property array{scope: string, title: string, category: string}|null $evidence
 * @property Carbon|null $status_changed_at
 * @property-read Requirement $requirement
 */
class Gap extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = [
        'tender_id', 'requirement_id', 'severity', 'title', 'description', 'remedy', 'time_to_close_days',
        'status', 'owner', 'evidence', 'status_changed_at', 'status_changed_by',
    ];

    protected function casts(): array
    {
        return [
            'severity' => GapSeverity::class,
            'time_to_close_days' => 'integer',
            'evidence' => 'array',
            'status_changed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Requirement, $this> */
    public function requirement(): BelongsTo
    {
        return $this->belongsTo(Requirement::class)->withTrashed();
    }

    /**
     * Shape of `Gap` in resources/js/types/ebis.ts.
     *
     * @return array<string, mixed>
     */
    public function toFrontend(): array
    {
        return array_filter([
            'id' => $this->id,
            'requirementId' => $this->requirement_id,
            'severity' => $this->severity->value,
            'title' => $this->title,
            'description' => $this->description,
            'remedy' => $this->remedy,
            'timeToCloseDays' => $this->time_to_close_days,
            'status' => $this->status,
            'owner' => $this->owner,
            'evidence' => $this->evidence,
        ], fn ($v) => $v !== null);
    }
}
