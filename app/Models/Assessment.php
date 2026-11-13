<?php

namespace App\Models;

use App\Enums\AssessmentStatus;
use App\Support\Tenancy\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The result for one requirement in one check run (ELG-02, EVD-01/03).
 *
 * @property string $id
 * @property string $run_id
 * @property string $requirement_id
 * @property int $requirement_version
 * @property AssessmentStatus $status
 * @property string $method
 * @property string $summary
 * @property string $reasoning
 * @property list<array<string, mixed>> $facts
 * @property array{factLabel: string, expiresAt: string}|null $stale
 * @property array{previousStatus: string, reason: string, by: string, at: string}|null $override
 * @property bool $reviewed
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read Requirement $requirement
 */
class Assessment extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = [
        'run_id', 'requirement_id', 'requirement_version', 'status', 'method', 'summary', 'reasoning',
        'facts', 'stale', 'override', 'reviewed',
    ];

    protected function casts(): array
    {
        return [
            'status' => AssessmentStatus::class,
            'requirement_version' => 'integer',
            'facts' => 'array',
            'stale' => 'array',
            'override' => 'array',
            'reviewed' => 'boolean',
        ];
    }

    /** @return BelongsTo<Requirement, $this> */
    public function requirement(): BelongsTo
    {
        return $this->belongsTo(Requirement::class)->withTrashed();
    }

    /**
     * Shape of `Assessment` in resources/js/types/ebis.ts. Needs `requirement.document` loaded.
     *
     * @return array<string, mixed>
     */
    public function toFrontend(): array
    {
        $req = $this->requirement;

        return array_filter([
            'id' => $this->id,
            'requirementId' => $this->requirement_id,
            'status' => $this->status->value,
            'confidence' => 1,
            'summary' => $this->summary,
            'evidence' => [
                'id' => "ev-{$this->id}",
                'requirementId' => $this->requirement_id,
                'clauseQuote' => $req->quote ?: $req->text,
                'source' => [
                    'documentId' => $req->document_id ?? '',
                    'documentName' => $req->document->name ?? '',
                    'page' => $req->page ?? 0,
                    'section' => $req->section,
                ],
                'profileFacts' => $this->facts,
                'reasoning' => $this->reasoning,
            ],
            'assessedAt' => $this->created_at->toIso8601ZuluString(),
            'assessedBy' => $this->method === 'user' ? 'You' : 'ebis-engine',
            'method' => $this->method,
            'stale' => $this->stale,
            'reviewed' => $this->reviewed,
            'override' => $this->override,
        ], fn ($v) => $v !== null);
    }
}
