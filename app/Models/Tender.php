<?php

namespace App\Models;

use App\Enums\BuyerType;
use App\Enums\ExtractionStatus;
use App\Enums\TenderStage;
use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Database\Factories\TenderFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * One tender: a pack of documents treated as a single record (ING-03), with the
 * details needed before it can be assessed (ING-04).
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $title
 * @property string|null $reference
 * @property string|null $summary
 * @property string $buyer_name
 * @property BuyerType $buyer_type
 * @property string|null $buyer_location
 * @property string|null $sector
 * @property Carbon|null $published_at
 * @property Carbon|null $clarification_deadline
 * @property Carbon $deadline
 * @property int|null $estimated_value
 * @property string $currency
 * @property int|null $lots
 * @property TenderStage $stage
 * @property int $version
 * @property int|null $created_by
 * @property Carbon|null $signed_off_at
 * @property int|null $signed_off_by
 * @property Carbon $created_at
 * @property-read Collection<int, TenderDocument> $documents
 * @property-read User|null $creator
 */
class Tender extends Model
{
    /** @use HasFactory<TenderFactory> */
    use BelongsToTenant, HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'title', 'reference', 'summary', 'buyer_name', 'buyer_type', 'buyer_location', 'sector',
        'published_at', 'clarification_deadline', 'deadline', 'estimated_value', 'currency', 'lots',
        'stage', 'version', 'created_by', 'signed_off_at', 'signed_off_by',
    ];

    protected function casts(): array
    {
        return [
            'buyer_type' => BuyerType::class,
            'stage' => TenderStage::class,
            'published_at' => 'datetime',
            'clarification_deadline' => 'datetime',
            'deadline' => 'datetime',
            'estimated_value' => 'integer',
            'lots' => 'integer',
            'version' => 'integer',
            'signed_off_at' => 'datetime',
        ];
    }

    /** @return HasMany<TenderDocument, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(TenderDocument::class)->orderBy('created_at')->orderBy('name');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** "Ref · Title" for the activity log. */
    public function label(): string
    {
        return $this->reference !== null ? "{$this->reference} · {$this->title}" : $this->title;
    }

    /**
     * Once every document has been read, the next job is pulling out requirements (M3).
     */
    public function refreshStage(): void
    {
        if ($this->stage !== TenderStage::Extraction) {
            return;
        }

        $pending = $this->documents()->where('extraction_status', ExtractionStatus::Pending->value)->exists();
        if (! $pending) {
            $this->forceFill(['stage' => TenderStage::Requirements])->save();
        }
    }

    /**
     * Shape of `Tender` in resources/js/types/ebis.ts. Needs `documents` and `creator` loaded.
     *
     * @return array<string, mixed>
     */
    public function toFrontend(): array
    {
        $owner = $this->creator->name ?? 'Former member';

        $data = [
            'id' => $this->id,
            'reference' => $this->reference ?? '',
            'title' => $this->title,
            'summary' => $this->summary ?? '',
            'buyer' => [
                'name' => $this->buyer_name,
                'type' => $this->buyer_type->value,
                'location' => $this->buyer_location ?? '',
            ],
            'source' => ['kind' => 'upload'],
            'publishedAt' => ($this->published_at ?? $this->created_at)->toIso8601ZuluString(),
            'clarificationDeadline' => $this->clarification_deadline?->toIso8601ZuluString(),
            'deadline' => $this->deadline->toIso8601ZuluString(),
            'estimatedValue' => $this->estimated_value !== null
                ? ['amount' => $this->estimated_value, 'currency' => $this->currency]
                : null,
            'sector' => $this->sector ?? '',
            'lots' => $this->lots,
            'stage' => $this->stage->value,
            'documents' => $this->documents->map->toFrontend()->values()->all(),
            'owner' => ['name' => $owner, 'initials' => self::initials($owner)],
            'createdAt' => $this->created_at->toIso8601ZuluString(),
            'version' => $this->version,
        ];

        // Optional in the TypeScript type: leave them out rather than send null.
        foreach (['clarificationDeadline', 'lots'] as $optional) {
            if ($data[$optional] === null) {
                unset($data[$optional]);
            }
        }

        return $data;
    }

    private static function initials(string $name): string
    {
        return Str::upper(collect(preg_split('/\s+/', trim($name)) ?: [])
            ->filter()
            ->take(2)
            ->map(fn (string $part) => mb_substr($part, 0, 1))
            ->implode(''));
    }
}
