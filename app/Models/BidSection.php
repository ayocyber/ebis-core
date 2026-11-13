<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A part of the written bid, answering one or more requirements (BID-01, BID-03).
 *
 * @property string $id
 * @property string $tender_id
 * @property string $title
 * @property list<string> $requirement_ids
 * @property string|null $body
 * @property int|null $word_limit
 * @property string $status
 * @property string|null $assignee
 * @property int $position
 * @property Carbon $updated_at
 * @property-read Collection<int, BidSectionVersion> $versions
 */
class BidSection extends Model
{
    use BelongsToTenant, HasUuids, SoftDeletes;

    public const STATUSES = ['not_started' => 'Not started', 'drafting' => 'Drafting', 'in_review' => 'In review', 'complete' => 'Complete'];

    protected $fillable = ['tender_id', 'title', 'requirement_ids', 'body', 'word_limit', 'status', 'assignee', 'position'];

    protected function casts(): array
    {
        return ['requirement_ids' => 'array', 'word_limit' => 'integer', 'position' => 'integer'];
    }

    /** @return HasMany<BidSectionVersion, $this> */
    public function versions(): HasMany
    {
        return $this->hasMany(BidSectionVersion::class, 'section_id')->latest('created_at')->latest('id');
    }

    /**
     * Shape of `BidSection` in resources/js/types/ebis.ts. Citations are the
     * [Fact] markers in the text; claim checks (BID-04) need AI and are not run.
     *
     * @return array<string, mixed>
     */
    public function toFrontend(): array
    {
        return array_filter([
            'id' => $this->id,
            'title' => $this->title,
            'requirementIds' => $this->requirement_ids,
            'body' => $this->body ?? '',
            'wordLimit' => $this->word_limit,
            'status' => $this->status,
            'citations' => [],
            'warnings' => [],
            'assignee' => $this->assignee,
        ], fn ($v) => $v !== null);
    }
}
