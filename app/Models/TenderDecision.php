<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Go / no-go (DEC-02): proceed or decline, with the reason and the blockers the
 * user acknowledged. Every decision is kept; the latest one counts.
 *
 * @property string $id
 * @property string $tender_id
 * @property string|null $run_id
 * @property string $outcome
 * @property string $reason
 * @property list<string> $acknowledged_blockers
 * @property list<string>|null $conditions
 * @property int|null $decided_by
 * @property Carbon $created_at
 * @property-read User|null $decider
 */
class TenderDecision extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['tender_id', 'run_id', 'outcome', 'reason', 'acknowledged_blockers', 'conditions', 'decided_by'];

    protected function casts(): array
    {
        return ['acknowledged_blockers' => 'array', 'conditions' => 'array'];
    }

    /** @return BelongsTo<User, $this> */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    /**
     * Shape of GoNoGoDecision in resources/js/types/ebis.ts.
     *
     * @return array<string, mixed>
     */
    public function toFrontend(): array
    {
        return array_filter([
            'outcome' => $this->outcome,
            'reason' => $this->reason,
            'acknowledgedBlockers' => $this->acknowledged_blockers,
            'conditions' => $this->conditions,
            'decidedBy' => $this->decider->name ?? 'Former member',
            'decidedAt' => $this->created_at->toIso8601ZuluString(),
        ], fn ($v) => $v !== null);
    }
}
