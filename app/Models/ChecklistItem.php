<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One thing the buyer wants submitted (BID-02).
 *
 * @property string $id
 * @property string $tender_id
 * @property string|null $key
 * @property string $kind
 * @property string $title
 * @property string $why
 * @property string $source
 * @property string $need
 * @property string|null $condition
 * @property list<string> $formats
 * @property string $file_stem
 * @property bool $signature
 * @property list<array{id: string, label: string, profile?: string, hint?: string}>|null $fields
 * @property string|null $vault_match
 * @property array<string, mixed>|null $progress
 * @property string|null $file_disk
 * @property string|null $file_path
 * @property int $position
 */
class ChecklistItem extends Model
{
    use BelongsToTenant, HasUuids, SoftDeletes;

    protected $fillable = [
        'tender_id', 'key', 'kind', 'title', 'why', 'source', 'need', 'condition', 'formats', 'file_stem', 'signature',
        'fields', 'vault_match', 'progress', 'file_disk', 'file_path', 'position',
    ];

    protected function casts(): array
    {
        return [
            'formats' => 'array',
            'signature' => 'boolean',
            'fields' => 'array',
            'progress' => 'array',
            'position' => 'integer',
        ];
    }

    /**
     * Shape of `ChecklistItem` in resources/js/types/ebis.ts. Form fields are
     * pre-filled from the company profile as it is now (BID-06).
     *
     * @return array<string, mixed>
     */
    public function toFrontend(?CompanyProfile $profile): array
    {
        return array_filter([
            'id' => $this->id,
            'kind' => $this->kind,
            'title' => $this->title,
            'why' => $this->why,
            'source' => $this->source,
            'need' => $this->need,
            'condition' => $this->condition,
            'formats' => $this->formats,
            'fileStem' => $this->file_stem,
            'signature' => $this->signature ?: null,
            'fields' => $this->fields === null ? null : array_map(function (array $f) use ($profile) {
                $value = isset($f['profile']) && $profile !== null ? self::profileValue($profile, $f['profile']) : null;

                return array_filter([
                    'id' => $f['id'],
                    'label' => $f['label'],
                    'prefill' => $value,
                    'from' => $value !== null ? 'Company profile' : null,
                    'hint' => $f['hint'] ?? null,
                ], fn ($v) => $v !== null);
            }, $this->fields),
            'vaultMatch' => $this->vault_match,
        ], fn ($v) => $v !== null);
    }

    private static function profileValue(CompanyProfile $profile, string $column): ?string
    {
        $value = $profile->getAttribute($column);
        if ($value instanceof \DateTimeInterface) {
            return $value->format('j F Y');
        }

        return is_scalar($value) && (string) $value !== '' ? (string) $value : null;
    }
}
