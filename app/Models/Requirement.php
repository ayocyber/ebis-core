<?php

namespace App\Models;

use App\Enums\RequirementCategory;
use App\Enums\RequirementTopic;
use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One thing the buyer asks for (TUN-01). `origin` is "found" for suggestions read
 * from the tender text, "manual" for ones the user typed (and "ai" later). Only
 * confirmed requirements are checked for eligibility.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $tender_id
 * @property string|null $code
 * @property string $title
 * @property string $text
 * @property RequirementCategory $category
 * @property RequirementTopic $topic
 * @property int|null $weight
 * @property string|null $document_id
 * @property int|null $page
 * @property string|null $section
 * @property string|null $quote
 * @property array<string, mixed>|null $check_rule
 * @property string $origin
 * @property string|null $quote_hash
 * @property Carbon|null $confirmed_at
 * @property int $version
 * @property Carbon $created_at
 * @property-read Tender $tender
 * @property-read TenderDocument|null $document
 */
class Requirement extends Model
{
    use BelongsToTenant, HasUuids, SoftDeletes;

    protected $fillable = [
        'tender_id', 'code', 'title', 'text', 'category', 'topic', 'weight', 'document_id', 'page', 'section',
        'quote', 'check_rule', 'origin', 'quote_hash', 'confirmed_at', 'confirmed_by', 'version', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'category' => RequirementCategory::class,
            'topic' => RequirementTopic::class,
            'weight' => 'integer',
            'page' => 'integer',
            'check_rule' => 'array',
            'confirmed_at' => 'datetime',
            'version' => 'integer',
        ];
    }

    /** @return BelongsTo<Tender, $this> */
    public function tender(): BelongsTo
    {
        return $this->belongsTo(Tender::class);
    }

    /** @return BelongsTo<TenderDocument, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(TenderDocument::class, 'document_id')->withoutText();
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeConfirmed(Builder $query): void
    {
        $query->whereNotNull('confirmed_at');
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeSuggested(Builder $query): void
    {
        $query->whereNull('confirmed_at');
    }

    public static function hashQuote(string $quote): string
    {
        return sha1(mb_strtolower((string) preg_replace('/\s+/', ' ', trim($quote))));
    }

    /**
     * Shape of `Requirement` in resources/js/types/ebis.ts, plus the review fields.
     *
     * @return array<string, mixed>
     */
    public function toFrontend(): array
    {
        return array_filter([
            'id' => $this->id,
            'tenderId' => $this->tender_id,
            'code' => $this->code ?? '',
            'title' => $this->title,
            'text' => $this->text,
            'category' => $this->category->value,
            'topic' => $this->topic->value,
            'weight' => $this->weight,
            'source' => [
                'documentId' => $this->document_id ?? '',
                'documentName' => $this->document->name ?? '',
                'page' => $this->page ?? 0,
                'section' => $this->section,
                'quote' => $this->quote ?? '',
            ],
            'check' => $this->check_rule,
            'origin' => $this->origin,
            'confirmed' => $this->confirmed_at !== null,
            'version' => $this->version,
        ], fn ($v) => $v !== null);
    }
}
