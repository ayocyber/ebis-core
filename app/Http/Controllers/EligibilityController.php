<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentStatus;
use App\Enums\AuditCategory;
use App\Models\Assessment;
use App\Models\CompanyProfile;
use App\Models\EligibilityRun;
use App\Models\Requirement;
use App\Models\Tender;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\AuditLog;
use App\Support\Eligibility\EligibilityRunner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** M4: the eligibility check of a real tender (ELG-*, EVD-*). */
class EligibilityController extends Controller
{
    public function index(string $tender, EligibilityRunner $runner): Response
    {
        $tender = Tender::with(['creator', 'documents' => fn ($q) => $q->withoutText()])->findOrFail($tender);
        $run = $runner->latestRun($tender);
        $requirements = Requirement::confirmed()->where('tender_id', $tender->id)->get(['id', 'version']);

        return Inertia::render('tenders/live/eligibility', [
            'tender' => $tender->toFrontend(),
            'rows' => $run !== null ? $runner->rows($run) : [],
            'confirmedCount' => $requirements->count(),
            'run' => $run === null ? null : [
                'id' => $run->id,
                'verdict' => $run->verdict,
                'score' => $run->score,
                'at' => $run->created_at->toIso8601ZuluString(),
                'by' => $run->runner->name ?? 'Former member',
                // Something it used has changed since: suggest running it again.
                'outdated' => $this->outdated($tender, $run, $requirements),
            ],
        ]);
    }

    public function run(Request $request, string $tender, EligibilityRunner $runner): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);

        /** @var User $user */
        $user = $request->user();
        $run = $runner->run($tender, $user);

        return to_route('tenders.eligibility', $tender->id)
            ->with('success', 'Eligibility checked: '.EligibilityRunner::verdictLabel($run->verdict).'.');
    }

    public function override(Request $request, string $tender, string $assessment, EligibilityRunner $runner): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $data = $request->validate([
            'status' => ['required', Rule::enum(AssessmentStatus::class)],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ], ['reason.required' => 'Say why you are changing the result.']);

        $a = $this->assessment($tender, $assessment);
        /** @var User $user */
        $user = $request->user();
        $runner->override($a, AssessmentStatus::from($data['status']), $data['reason'], $user);

        return back()->with('success', 'Result changed.');
    }

    public function review(Request $request, string $tender, string $assessment): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $a = $this->assessment($tender, $assessment);
        $a->forceFill(['reviewed' => ! $a->reviewed])->save();

        AuditLog::record(
            AuditCategory::Assessment,
            $a->reviewed ? 'reviewed the result for' : 'marked as not reviewed',
            "{$a->requirement->code} · {$a->requirement->title}",
            $a->status->label(),
            $a,
            $request->user(),
            $a->requirement->tender_id,
        );

        return back();
    }

    /** Only assessments from the latest run of this tender can be changed. */
    private function assessment(string $tender, string $assessment): Assessment
    {
        $tender = Tender::findOrFail($tender);
        $run = app(EligibilityRunner::class)->latestRun($tender);
        abort_if($run === null, 404);

        return Assessment::with('requirement')->where('run_id', $run->id)->findOrFail($assessment);
    }

    /**
     * @param  Collection<int, Requirement>  $requirements
     */
    private function outdated(Tender $tender, EligibilityRun $run, $requirements): bool
    {
        $used = $run->assessments->pluck('requirement_version', 'requirement_id');
        $now = $requirements->pluck('version', 'id');

        return $tender->version !== $run->tender_version
            || CompanyProfile::value('version') !== $run->profile_version
            || $used->sortKeys()->all() !== $now->sortKeys()->all()
            || EligibilityRunner::vaultFingerprint(VaultDocument::current()->get()) !== $run->vault_fingerprint;
    }
}
