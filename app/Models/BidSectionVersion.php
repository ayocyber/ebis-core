<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * A saved copy of a section that can be restored (BID-05).
 *
 * @property string $id
 * @property string $section_id
 * @property string $label
 * @property string $body
 * @property string $by_name
 * @property Carbon $created_at
 */
class BidSectionVersion extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['section_id', 'label', 'body', 'by_name'];

    /**
     * Shape of `SectionVersion` in resources/js/hooks/use-tender-workspace.ts.
     *
     * @return array<string, string>
     */
    public function toFrontend(): array
    {
        return [
            'id' => $this->id,
            'at' => $this->created_at->toIso8601ZuluString(),
            'by' => $this->by_name,
            'label' => $this->label,
            'body' => $this->body,
        ];
    }
}
