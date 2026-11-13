<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One eligibility check of a tender (ELG-02/04, EVD-04): which tender and profile
 * versions it used, its verdict and score, and one assessment per requirement.
 *
 * @property string $id
 * @property string $tender_id
 * @property int $tender_version
 * @property int|null $profile_version
 * @property string|null $vault_fingerprint
 * @property string $verdict
 * @property int $score
 * @property int|null $run_by
 * @property Carbon $created_at
 * @property-read Collection<int, Assessment> $assessments
 * @property-read User|null $runner
 */
class EligibilityRun extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['tender_id', 'tender_version', 'profile_version', 'vault_fingerprint', 'verdict', 'score', 'run_by'];

    protected function casts(): array
    {
        return ['tender_version' => 'integer', 'profile_version' => 'integer', 'score' => 'integer'];
    }

    /** @return HasMany<Assessment, $this> */
    public function assessments(): HasMany
    {
        return $this->hasMany(Assessment::class, 'run_id');
    }

    /** @return BelongsTo<User, $this> */
    public function runner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'run_by');
    }
}
