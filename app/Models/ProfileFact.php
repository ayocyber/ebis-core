<?php

namespace App\Models;

use App\Enums\ProfileFactSource;
use App\Enums\VerificationStatus;
use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One thing a tender can check, e.g. "Cyber Essentials Plus: certified, valid to 31 Oct 2026".
 * PRF-03: records its source document, issue and expiry dates and whether it is verified.
 * Eligibility (M4) reads facts, never documents directly.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string|null $vault_document_id
 * @property string|null $key
 * @property string $label
 * @property string $value
 * @property ProfileFactSource $source
 * @property Carbon|null $issued_at
 * @property Carbon|null $expires_at
 * @property Carbon|null $verified_at
 * @property int|null $verified_by
 * @property-read VaultDocument|null $document
 */
class ProfileFact extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['vault_document_id', 'key', 'label', 'value', 'source', 'issued_at', 'expires_at', 'verified_at', 'verified_by'];

    protected function casts(): array
    {
        return [
            'source' => ProfileFactSource::class,
            'issued_at' => 'date',
            'expires_at' => 'date',
            'verified_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VaultDocument, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(VaultDocument::class, 'vault_document_id');
    }

    /** No source document or no confirmation → unverified. Past its expiry → expired. */
    public function verification(?Carbon $on = null): VerificationStatus
    {
        if ($this->expires_at !== null && $this->expires_at->lt(($on ?? now())->startOfDay())) {
            return VerificationStatus::Expired;
        }

        return $this->vault_document_id !== null && $this->verified_at !== null
            ? VerificationStatus::Verified
            : VerificationStatus::Unverified;
    }
}
