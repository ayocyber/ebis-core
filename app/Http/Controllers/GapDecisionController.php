<?php

namespace App\Http\Controllers;

use App\Enums\AuditCategory;
use App\Enums\RequirementCategory;
use App\Enums\TenderStage;
use App\Models\EligibilityRun;
use App\Models\Gap;
use App\Models\Tender;
use App\Models\TenderDecision;
use App\Support\AuditLog;
use App\Support\Eligibility\EligibilityRunner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** M5: the gap plan (GAP-05) and the go / no-go decision (DEC-01/02) of a real tender. */
class GapDecisionController extends Controller
{
    private const GAP_STATUS = ['open' => 'Open', 'in_progress' => 'In progress', 'closed' => 'Closed'];

    public function gaps(string $tender, EligibilityRunner $runner): Response|RedirectResponse
    {
        [$tender, $run] = $this->withRun($tender, $runner);
        if ($run === null) {
            return $this->needsCheck($tender);
        }

        return Inertia::render('tenders/live/gaps', [
            'tender' => $tender->toFrontend(),
            'rows' => $runner->rows($run),
        ]);
    }

    public function updateGap(Request $request, string $tender, string $gap): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);
        $gap = Gap::with('requirement')->where('tender_id', $tender->id)->findOrFail($gap);
        $data = $request->validate([
            'status' => ['required', Rule::in(array_keys(self::GAP_STATUS))],
            'owner' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $from = $gap->status;
        $gap->fill($data);
        if (! $gap->isDirty()) {
            return back();
        }

        DB::transaction(function () use ($gap, $from, $request, $tender) {
            $gap->forceFill(['status_changed_at' => now(), 'status_changed_by' => $request->user()?->getKey()])->save();
            AuditLog::record(
                AuditCategory::Gap,
                $gap->status === 'closed' ? 'closed the gap' : 'updated the gap',
                "{$gap->requirement->code} · {$gap->title}",
                self::GAP_STATUS[$from].' → '.self::GAP_STATUS[$gap->status].($gap->owner ? " · owner {$gap->owner}" : ''),
                $gap,
                $request->user(),
                $tender->id,
            );
        });

        return back()->with('success', 'Gap updated.');
    }

    public function decision(string $tender, EligibilityRunner $runner): Response|RedirectResponse
    {
        [$tender, $run] = $this->withRun($tender, $runner);
        if ($run === null) {
            return $this->needsCheck($tender);
        }

        $decision = TenderDecision::with('decider')->where('tender_id', $tender->id)->latest('created_at')->latest('id')->first();

        return Inertia::render('tenders/live/decision', [
            'tender' => $tender->toFrontend(),
            'rows' => $runner->rows($run),
            'decision' => $decision?->toFrontend(),
        ]);
    }

    /** DEC-02. Only owners decide, as on the sample screen. */
    public function decide(Request $request, string $tender, EligibilityRunner $runner): RedirectResponse
    {
        Gate::authorize('manage-tenant');
        [$tender, $run] = $this->withRun($tender, $runner);
        abort_if($run === null, 409, 'Run the eligibility check first.');

        $data = $request->validate([
            'outcome' => ['required', Rule::in(['proceed', 'decline'])],
            'reason' => ['nullable', 'string', 'max:1000'],
            'acknowledged_blockers' => ['array'],
            'acknowledged_blockers.*' => ['string'],
            'conditions' => ['array'],
            'conditions.*' => ['string', 'max:300'],
        ]);

        // Bidding means accepting every open mandatory gap as a condition.
        $open = Gap::where('tender_id', $tender->id)
            ->where('status', '!=', 'closed')
            ->whereHas('requirement', fn ($q) => $q->where('category', RequirementCategory::Mandatory->value)->whereNotNull('confirmed_at'))
            ->pluck('id');
        $missing = $open->diff($data['acknowledged_blockers'] ?? []);
        if ($data['outcome'] === 'proceed' && $missing->isNotEmpty()) {
            throw ValidationException::withMessages(['acknowledged_blockers' => 'Accept each open mandatory gap as a condition before deciding to bid.']);
        }

        DB::transaction(function () use ($tender, $run, $data, $request) {
            TenderDecision::create([
                'tender_id' => $tender->id,
                'run_id' => $run->id,
                'outcome' => $data['outcome'],
                'reason' => trim((string) ($data['reason'] ?? '')),
                'acknowledged_blockers' => array_values($data['acknowledged_blockers'] ?? []),
                'conditions' => $data['outcome'] === 'proceed' ? array_values($data['conditions'] ?? []) : null,
                'decided_by' => $request->user()?->getKey(),
            ]);

            // DEC-04: a "bid" moves the tender on to preparing the bid; "don't bid" leaves it at the decision.
            $before = [TenderStage::Intake, TenderStage::Extraction, TenderStage::Requirements, TenderStage::Eligibility, TenderStage::Gaps, TenderStage::Decision];
            if (in_array($tender->stage, $before, true)) {
                $tender->forceFill(['stage' => $data['outcome'] === 'proceed' ? TenderStage::Compliance : TenderStage::Decision])->save();
            }

            AuditLog::record(
                AuditCategory::Decision,
                $data['outcome'] === 'proceed' ? 'decided to bid for' : 'decided not to bid for',
                $tender->label(),
                trim(implode(' · ', array_filter([
                    ($data['reason'] ?? '') !== '' ? "“{$data['reason']}”" : null,
                    count($data['acknowledged_blockers'] ?? []) ? count($data['acknowledged_blockers']).' open gaps accepted as conditions' : null,
                ]))) ?: null,
                $tender,
                $request->user(),
                $tender->id,
            );
        });

        return back()->with('success', $data['outcome'] === 'proceed' ? 'Decision recorded: bid.' : 'Decision recorded: don’t bid.');
    }

    /**
     * @return array{0: Tender, 1: EligibilityRun|null}
     */
    private function withRun(string $tender, EligibilityRunner $runner): array
    {
        $tender = Tender::with(['creator', 'documents' => fn ($q) => $q->withoutText()])->findOrFail($tender);

        return [$tender, $runner->latestRun($tender)];
    }

    private function needsCheck(Tender $tender): RedirectResponse
    {
        return to_route('tenders.eligibility', $tender->id)->with('error', 'Run the eligibility check first. Gaps and the decision come from it.');
    }
}
