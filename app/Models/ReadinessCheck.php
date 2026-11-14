<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * One readiness result (VAL-06/07): the score and how many critical issues.
 *
 * @property string $id
 * @property string $tender_id
 * @property int $score
 * @property int $critical
 * @property string $by_name
 * @property bool $manual
 * @property Carbon $created_at
 */
class ReadinessCheck extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['tender_id', 'score', 'critical', 'by_name', 'manual'];

    protected function casts(): array
    {
        return ['score' => 'integer', 'critical' => 'integer', 'manual' => 'boolean'];
    }

    /**
     * Shape of `ScoreRun` in resources/js/hooks/use-tender-workspace.ts.
     *
     * @return array<string, mixed>
     */
    public function toFrontend(): array
    {
        return ['at' => $this->created_at->toIso8601ZuluString(), 'score' => $this->score, 'critical' => $this->critical, 'by' => $this->by_name];
    }
}
