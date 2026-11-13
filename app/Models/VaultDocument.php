<?php

namespace App\Models;

use App\Enums\VaultCategory;
use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Database\Factories\VaultDocumentFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A file in the company's evidence vault (PRF-02). Each one proves at least one
 * ProfileFact. Renewing a document archives the old version instead of deleting it,
 * and deleting is soft, so the evidence trail behind past assessments survives.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $title
 * @property VaultCategory $category
 * @property string $file_name
 * @property string $kind
 * @property string $mime_type
 * @property int $size_bytes
 * @property string $disk
 * @property string $path
 * @property string $sha256
 * @property string|null $issuer
 * @property string|null $reference
 * @property Carbon|null $issued_at
 * @property Carbon|null $expires_at
 * @property string|null $summary
 * @property string|null $replaces_id
 * @property Carbon|null $archived_at
 * @property Carbon|null $alerted_90_at
 * @property Carbon|null $alerted_30_at
 * @property int|null $uploaded_by
 * @property Carbon $created_at
 * @property-read Collection<int, ProfileFact> $facts
 * @property-read User|null $uploader
 */
class VaultDocument extends Model
{
    /** @use HasFactory<VaultDocumentFactory> */
    use BelongsToTenant, HasFactory, HasUuids, SoftDeletes;

    public const MAX_KB = 25 * 1024;

    public const EXTENSIONS = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];

    protected $fillable = [
        'title', 'category', 'file_name', 'kind', 'mime_type', 'size_bytes', 'disk', 'path', 'sha256',
        'issuer', 'reference', 'issued_at', 'expires_at', 'summary', 'replaces_id', 'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'category' => VaultCategory::class,
            'size_bytes' => 'integer',
            'issued_at' => 'date',
            'expires_at' => 'date',
            'archived_at' => 'datetime',
            'alerted_90_at' => 'datetime',
            'alerted_30_at' => 'datetime',
        ];
    }

    /** @return HasMany<ProfileFact, $this> */
    public function facts(): HasMany
    {
        return $this->hasMany(ProfileFact::class);
    }

    /** @return BelongsTo<User, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Documents in use (not replaced by a newer version).
     *
     * @param  Builder<self>  $query
     */
    public function scopeCurrent(Builder $query): void
    {
        $query->whereNull('archived_at');
    }

    public function isExpired(?Carbon $on = null): bool
    {
        return $this->expires_at !== null && $this->expires_at->lt(($on ?? now())->startOfDay());
    }

    /** "pdf" or "docx", as the frontend's TenderDocumentKind expects. Images display as PDFs. */
    public static function kindFor(string $extension): string
    {
        return strtolower($extension) === 'docx' ? 'docx' : 'pdf';
    }

    /**
     * Shape of `VaultDocument` in resources/js/types/ebis.ts. Needs `facts` and `uploader` loaded.
     *
     * @return array<string, mixed>
     */
    public function toFrontend(): array
    {
        return array_filter([
            'id' => $this->id,
            'title' => $this->title,
            'category' => $this->category->value,
            'fileName' => $this->file_name,
            'kind' => $this->kind,
            'sizeBytes' => $this->size_bytes,
            'issuer' => $this->issuer,
            'reference' => $this->reference,
            'issuedAt' => $this->issued_at?->toDateString(),
            'expiresAt' => $this->expires_at?->toDateString(),
            'summary' => $this->summary ?? '',
            // Tenders ask for facts by key; facts without one are referred to by id.
            'factIds' => $this->facts->map(fn (ProfileFact $f) => $f->key ?? $f->id)->values()->all(),
            'uploadedAt' => $this->created_at->toIso8601ZuluString(),
            'uploadedBy' => $this->uploader->name ?? 'Former member',
            'replaces' => $this->replaces_id,
        ], fn ($v) => $v !== null);
    }
}
