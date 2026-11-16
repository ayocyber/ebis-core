<?php

namespace App\Models;

use App\Enums\BuyerType;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * An open tender from the public feeds (Find a Tender, Contracts Finder).
 *
 * @property string $id
 * @property string $source
 * @property string $ocid
 * @property string $notice_id
 * @property string $match_key
 * @property string $title
 * @property string|null $description
 * @property string $buyer_name
 * @property BuyerType $buyer_type
 * @property int|null $value
 * @property string $currency
 * @property Carbon $deadline
 * @property Carbon|null $published_at
 * @property string|null $cpv
 * @property string|null $cpv_label
 * @property list<string>|null $regions
 * @property bool|null $sme_suitable
 * @property string $url
 * @property string|null $submission_url
 * @property list<array{title: string, url: string, format: string|null}>|null $documents
 * @property list<array{name: string, type: string, weight: int|null}>|null $award_criteria
 * @property list<string>|null $selection
 */
class Opportunity extends Model
{
    use HasUuids;

    public const SOURCES = ['fts' => 'Find a Tender', 'cf' => 'Contracts Finder'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'buyer_type' => BuyerType::class,
            'value' => 'integer',
            'deadline' => 'datetime',
            'published_at' => 'datetime',
            'regions' => 'array',
            'sme_suitable' => 'boolean',
            'documents' => 'array',
            'award_criteria' => 'array',
            'selection' => 'array',
        ];
    }

    public function sourceName(): string
    {
        return self::SOURCES[$this->source] ?? $this->source;
    }
}
