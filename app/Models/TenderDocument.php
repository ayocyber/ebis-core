<?php

namespace App\Models;

use App\Enums\ExtractionStatus;
use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One file in a tender pack, plus the text read from it (ING-02).
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $tender_id
 * @property string $name
 * @property string $kind
 * @property string $role
 * @property int $size_bytes
 * @property int|null $pages
 * @property string $disk
 * @property string $path
 * @property string $sha256
 * @property string|null $from_archive
 * @property ExtractionStatus $extraction_status
 * @property string|null $extracted_text
 * @property list<int>|null $unreadable_pages
 * @property string|null $extraction_error
 * @property Carbon|null $extracted_at
 * @property int|null $uploaded_by
 * @property Carbon $created_at
 * @property-read Tender $tender
 */
class TenderDocument extends Model
{
    use BelongsToTenant, HasUuids, SoftDeletes;

    /** ING-01 */
    public const MAX_KB = 50 * 1024;

    public const EXTENSIONS = ['pdf', 'docx', 'zip'];

    /** What can be read inside a ZIP. Anything else is listed as skipped. */
    public const READABLE = ['pdf', 'docx'];

    protected $fillable = [
        'tender_id', 'name', 'kind', 'role', 'size_bytes', 'pages', 'disk', 'path', 'sha256', 'from_archive',
        'extraction_status', 'extracted_text', 'unreadable_pages', 'extraction_error', 'extracted_at', 'uploaded_by',
    ];

    /** The text can be megabytes; it is only loaded when asked for. */
    protected $hidden = ['extracted_text'];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'pages' => 'integer',
            'extraction_status' => ExtractionStatus::class,
            'unreadable_pages' => 'array',
            'extracted_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Tender, $this> */
    public function tender(): BelongsTo
    {
        return $this->belongsTo(Tender::class);
    }

    /**
     * Every column except the extracted text.
     *
     * @param  Builder<self>  $query
     */
    public function scopeWithoutText(Builder $query): void
    {
        $query->select(array_map(
            fn (string $column) => $this->qualifyColumn($column),
            ['id', 'tenant_id', 'tender_id', 'name', 'kind', 'role', 'size_bytes', 'pages', 'disk', 'path', 'sha256',
                'from_archive', 'extraction_status', 'unreadable_pages', 'extraction_error', 'extracted_at',
                'uploaded_by', 'created_at', 'updated_at', 'deleted_at'],
        ));
    }

    /**
     * A sensible label from the file name, until requirement extraction (M3) can
     * read the document itself.
     */
    public static function guessRole(string $fileName): string
    {
        $name = strtolower(pathinfo($fileName, PATHINFO_FILENAME));

        return match (true) {
            (bool) preg_match('/\b(itt|invitation|instructions?)\b/', $name) => 'Invitation to tender',
            (bool) preg_match('/\b(spec|specification|requirements?|sow|scope)\b/', $name) => 'Specification',
            (bool) preg_match('/\b(pric(e|ing)|cost|commercial)\b/', $name) => 'Pricing schedule',
            (bool) preg_match('/\b(sq|pqq|selection|questionnaire)\b/', $name) => 'Selection questionnaire',
            (bool) preg_match('/\b(contract|terms|conditions|t&cs?)\b/', $name) => 'Contract terms',
            (bool) preg_match('/\b(evaluation|award|criteria|scoring)\b/', $name) => 'Award criteria',
            (bool) preg_match('/\b(form|declaration|appendix|annex|schedule)\b/', $name) => 'Form or appendix',
            default => 'Tender document',
        };
    }

    /**
     * Shape of `TenderDocument` in resources/js/types/ebis.ts.
     *
     * @return array<string, mixed>
     */
    public function toFrontend(): array
    {
        return array_filter([
            'id' => $this->id,
            'name' => $this->name,
            'kind' => $this->kind,
            'sizeBytes' => $this->size_bytes,
            'pages' => $this->pages,
            'role' => $this->role,
            'uploadedAt' => $this->created_at->toIso8601ZuluString(),
            'fromArchive' => $this->from_archive,
            'extraction' => array_filter([
                'status' => $this->extraction_status->value,
                'unreadablePages' => $this->unreadable_pages ?: null,
                'error' => $this->extraction_error,
            ], fn ($v) => $v !== null),
        ], fn ($v) => $v !== null);
    }
}
