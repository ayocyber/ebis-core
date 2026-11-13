<?php

namespace App\Support\Bid;

use App\Enums\AuditCategory;
use App\Enums\RequirementCategory;
use App\Enums\RequirementTopic;
use App\Models\BidSection;
use App\Models\BidSectionVersion;
use App\Models\Requirement;
use App\Models\Tender;
use App\Models\User;
use App\Support\AuditLog;
use Illuminate\Support\Facades\DB;

/**
 * The written bid of a tender (M6): its sections, which requirements each answers
 * (the compliance matrix, BID-01) and their versions (BID-05).
 */
class BidWorkspace
{
    /** Section titles for mandatory requirements, grouped by topic. Submission rules belong in the checklist. */
    private const TOPIC_SECTIONS = [
        'financial' => 'Financial standing',
        'insurance' => 'Insurance',
        'certification' => 'Certifications and accreditations',
        'experience' => 'Experience and references',
        'personnel' => 'Staff, skills and vetting',
        'technical' => 'Technical approach',
        'legal' => 'Legal and regulatory',
        'social_value' => 'Social value',
    ];

    /**
     * DEC-04: deciding to bid creates the workspace, carrying the requirements over
     * without re-entry. Mandatory requirements are grouped by topic; each scored one
     * gets its own section. Does nothing if sections already exist.
     */
    public function ensure(Tender $tender): void
    {
        if (BidSection::withTrashed()->where('tender_id', $tender->id)->exists()) {
            return;
        }

        $reqs = Requirement::confirmed()->where('tender_id', $tender->id)->orderBy('code')->get();
        $position = 0;

        DB::transaction(function () use ($tender, $reqs, &$position) {
            $mandatory = $reqs->filter(fn (Requirement $r) => $r->category === RequirementCategory::Mandatory && $r->topic !== RequirementTopic::Submission);
            foreach (self::TOPIC_SECTIONS as $topic => $title) {
                $ids = $mandatory->filter(fn (Requirement $r) => $r->topic->value === $topic)->pluck('id')->values()->all();
                if ($ids !== []) {
                    BidSection::create(['tender_id' => $tender->id, 'title' => $title, 'requirement_ids' => $ids, 'position' => $position++]);
                }
            }

            foreach ($reqs->filter(fn (Requirement $r) => $r->category === RequirementCategory::Scored) as $r) {
                BidSection::create(['tender_id' => $tender->id, 'title' => $r->title, 'requirement_ids' => [$r->id], 'position' => $position++]);
            }
        });
    }

    /** Move a requirement to a section, or out of every section (null). */
    public function map(Tender $tender, Requirement $req, ?BidSection $to, User $by): void
    {
        DB::transaction(function () use ($tender, $req, $to, $by) {
            foreach (BidSection::where('tender_id', $tender->id)->get() as $s) {
                $ids = array_values(array_diff($s->requirement_ids, [$req->id]));
                if ($s->is($to)) {
                    $ids[] = $req->id;
                }
                if ($ids !== $s->requirement_ids) {
                    $s->forceFill(['requirement_ids' => $ids])->save();
                }
            }

            AuditLog::record(AuditCategory::Bid, $to ? 'mapped a requirement to' : 'unmapped a requirement in', $to->title ?? $tender->label(),
                "{$req->code} · {$req->title}", $req, $by, $tender->id);
        });
    }

    /** BID-05. Skips a copy identical to the latest one. */
    public function saveVersion(BidSection $section, string $label, User $by): ?BidSectionVersion
    {
        $body = (string) $section->body;
        $latest = $section->versions()->first();
        if (trim($body) === '' || ($latest !== null && $latest->body === $body)) {
            return null;
        }

        return $section->versions()->create(['label' => $label, 'body' => $body, 'by_name' => $by->name]);
    }

    /** Keeps what is replaced, so a restore can itself be undone. */
    public function restore(BidSection $section, BidSectionVersion $version, User $by): void
    {
        DB::transaction(function () use ($section, $version, $by) {
            $this->saveVersion($section, 'Before restore', $by);
            $section->forceFill(['body' => $version->body])->save();
            $section->versions()->create(['label' => "Restored “{$version->label}”", 'body' => $version->body, 'by_name' => $by->name]);

            AuditLog::record(AuditCategory::Bid, 'restored an earlier version in', $section->title,
                "{$version->label} by {$version->by_name}, {$version->created_at->format('j M Y H:i')}", $section, $by, $section->tender_id);
        });
    }
}
