<?php

namespace App\Support\Eligibility;

use App\Enums\AssessmentStatus;
use App\Enums\AuditCategory;
use App\Enums\GapSeverity;
use App\Enums\RequirementCategory;
use App\Enums\TenderStage;
use App\Models\Assessment;
use App\Models\CompanyProfile;
use App\Models\EligibilityRun;
use App\Models\Gap;
use App\Models\Requirement;
use App\Models\Tender;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\AuditLog;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Runs the eligibility check for a tender (M4) and keeps its gaps up to date (M5).
 *
 * Every run is kept with the tender, profile and requirement versions it used
 * (EVD-04). A user's status on a requirement carries over to the next run while
 * the requirement is unchanged, so judgement calls are not lost.
 */
class EligibilityRunner
{
    public function run(Tender $tender, User $by): EligibilityRun
    {
        $requirements = Requirement::confirmed()->where('tender_id', $tender->id)->get();
        if ($requirements->isEmpty()) {
            throw ValidationException::withMessages(['requirements' => 'Confirm at least one requirement before running the check.']);
        }

        $profile = CompanyProfile::first();
        $vault = VaultDocument::current()->with('facts')->get();
        $checker = new EligibilityChecker($profile, $vault, $tender->deadline);
        $previous = $this->latestRun($tender)?->assessments->keyBy('requirement_id') ?? collect();

        return DB::transaction(function () use ($tender, $by, $requirements, $profile, $vault, $checker, $previous) {
            $run = EligibilityRun::create([
                'tender_id' => $tender->id,
                'tender_version' => $tender->version,
                'profile_version' => $profile?->version,
                'vault_fingerprint' => self::vaultFingerprint($vault),
                'verdict' => 'conditional',
                'score' => 0,
                'run_by' => $by->getKey(),
            ]);

            foreach ($requirements as $req) {
                $outcome = $checker->check($req);
                $before = $previous->get($req->id);
                // Keep the user's own call while the requirement hasn't changed.
                $kept = $before?->override !== null && $before->requirement_version === $req->version;

                $assessment = $run->assessments()->create([
                    'requirement_id' => $req->id,
                    'requirement_version' => $req->version,
                    'status' => $kept ? $before->status : $outcome->status,
                    'method' => $outcome->method,
                    'summary' => $outcome->summary,
                    'reasoning' => $outcome->reasoning,
                    'facts' => $outcome->facts,
                    'stale' => $outcome->stale,
                    'override' => $kept ? $before->override : null,
                    'reviewed' => $kept || ($before?->reviewed && $before->status === $outcome->status && $before->requirement_version === $req->version),
                ]);
                $this->syncGap($tender, $req, $assessment, $outcome->fix);
            }

            $this->score($run);

            if (in_array($tender->stage, [TenderStage::Intake, TenderStage::Extraction, TenderStage::Requirements], true)) {
                $tender->forceFill(['stage' => TenderStage::Eligibility])->save();
            }

            $counts = $run->assessments->countBy(fn (Assessment $a) => $a->status->label());
            AuditLog::record(
                AuditCategory::Assessment,
                'ran the eligibility check for',
                $tender->label(),
                self::verdictLabel($run->verdict).' · '.$counts->map(fn ($n, $label) => "{$n} {$label}")->implode(', '),
                $run,
                $by,
                $tender->id,
            );

            return $run;
        });
    }

    /** ELG-06: a user sets the status, with a reason. Logged with before → after. */
    public function override(Assessment $assessment, AssessmentStatus $status, string $reason, User $by): void
    {
        DB::transaction(function () use ($assessment, $status, $reason, $by) {
            $from = $assessment->status;
            $assessment->forceFill([
                'status' => $status,
                'reviewed' => true,
                'override' => [
                    'previousStatus' => $assessment->override['previousStatus'] ?? $from->value,
                    'reason' => $reason,
                    'by' => $by->name,
                    'at' => now()->toIso8601ZuluString(),
                ],
            ])->save();

            $req = $assessment->requirement;
            $tender = $req->tender;
            $existing = Gap::where('tender_id', $tender->id)->where('requirement_id', $req->id)->first();
            $this->syncGap($tender, $req, $assessment, $existing !== null ? [
                'remedy' => $existing->remedy, 'days' => $existing->time_to_close_days, 'evidence' => $existing->evidence,
            ] : ['remedy' => 'Close this before the deadline.', 'days' => 5]);
            $this->score(EligibilityRun::findOrFail($assessment->run_id));

            AuditLog::record(
                AuditCategory::Override,
                'overrode the result for',
                "{$req->code} · {$req->title}",
                "{$from->label()} → {$status->label()} · “{$reason}”",
                $assessment,
                $by,
                $tender->id,
            );
        });
    }

    public function latestRun(Tender $tender): ?EligibilityRun
    {
        return EligibilityRun::where('tender_id', $tender->id)->latest('created_at')->latest('id')->with('assessments')->first();
    }

    /**
     * EligibilityRow shapes (resources/js/types/ebis.ts) for the latest run.
     *
     * @return list<array<string, mixed>>
     */
    public function rows(EligibilityRun $run): array
    {
        $assessments = $run->assessments()->with('requirement.document')->get();
        $gaps = Gap::where('tender_id', $run->tender_id)->get()->keyBy('requirement_id');

        return array_values($assessments->map(fn (Assessment $a) => array_filter([
            'requirement' => $a->requirement->toFrontend(),
            'assessment' => $a->toFrontend(),
            'gap' => $gaps->get($a->requirement_id)?->toFrontend(),
        ], fn ($v) => $v !== null))->all());
    }

    /**
     * GAP-01…04: one gap per requirement that isn't met, kept across runs. A
     * requirement that is now met closes its gap.
     *
     * @param  array{remedy: string, days: int, evidence?: array<string, string>|null}|null  $fix
     */
    private function syncGap(Tender $tender, Requirement $req, Assessment $a, ?array $fix): void
    {
        $gap = Gap::where('tender_id', $tender->id)->where('requirement_id', $req->id)->first();

        if ($a->status === AssessmentStatus::Met) {
            if ($gap !== null && $gap->status !== 'closed') {
                $gap->forceFill(['status' => 'closed', 'status_changed_at' => now(), 'status_changed_by' => null])->save();
            }

            return;
        }

        $days = $fix['days'] ?? 5;
        $daysLeft = self::workingDaysUntil($tender->deadline);
        $severity = match (true) {
            $req->category !== RequirementCategory::Mandatory => $a->status === AssessmentStatus::NotMet ? GapSeverity::Fixable : GapSeverity::Minor,
            // GAP-02: mandatory and can't realistically be closed in time.
            $days > $daysLeft => GapSeverity::Blocker,
            default => GapSeverity::Fixable,
        };

        $attributes = [
            'severity' => $severity,
            'title' => $req->title,
            'description' => $a->summary.'. '.$a->reasoning,
            'remedy' => $fix['remedy'] ?? 'Close this before the deadline.',
            'time_to_close_days' => $days,
            'evidence' => $fix['evidence'] ?? null,
        ];

        if ($gap === null) {
            Gap::create([...$attributes, 'tender_id' => $tender->id, 'requirement_id' => $req->id, 'status' => 'open']);

            return;
        }

        // A gap the check closed itself reopens when the requirement fails again.
        $reopen = $gap->status === 'closed' && $gap->status_changed_by === null;
        $gap->fill($attributes + ($reopen ? ['status' => 'open', 'status_changed_at' => now()] : []))->save();
    }

    private function score(EligibilityRun $run): void
    {
        $run->load('assessments.requirement');
        $mandatory = $run->assessments->filter(fn (Assessment $a) => $a->requirement->category === RequirementCategory::Mandatory);
        $count = fn (AssessmentStatus $s) => $mandatory->filter(fn (Assessment $a) => $a->status === $s)->count();

        $total = $mandatory->count();
        $score = $total > 0 ? (int) round((($count(AssessmentStatus::Met) + $count(AssessmentStatus::PartiallyMet) * 0.5) / $total) * 100) : 0;
        $verdict = match (true) {
            $count(AssessmentStatus::NotMet) > 0 => 'does_not_qualify',
            $count(AssessmentStatus::PartiallyMet) + $count(AssessmentStatus::Unknown) > 0 => 'conditional',
            default => 'qualifies',
        };

        $run->forceFill(['score' => $score, 'verdict' => $verdict])->save();
    }

    /**
     * Which documents are in the vault and their expiry dates: everything a check
     * reads from it. A different fingerprint means the vault changed since.
     *
     * @param  Collection<int, VaultDocument>  $vault
     */
    public static function vaultFingerprint(Collection $vault): string
    {
        return sha1($vault->map(fn (VaultDocument $d) => $d->id.'@'.$d->expires_at?->toDateString().'#'.$d->title)->sort()->implode('|'));
    }

    public static function verdictLabel(string $verdict): string
    {
        return ['qualifies' => 'Qualifies', 'conditional' => 'Not confirmed yet', 'does_not_qualify' => 'Does not qualify yet'][$verdict] ?? $verdict;
    }

    /** Monday to Friday between now and the deadline. */
    public static function workingDaysUntil(Carbon $deadline): int
    {
        $from = now()->startOfDay();
        if ($deadline->lte($from)) {
            return 0;
        }

        return (int) $from->diffInWeekdays($deadline->copy()->startOfDay());
    }
}
