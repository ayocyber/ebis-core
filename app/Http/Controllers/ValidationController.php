<?php

namespace App\Http\Controllers;

use App\Enums\AuditCategory;
use App\Enums\TenderStage;
use App\Models\BidSection;
use App\Models\ChecklistItem;
use App\Models\CompanyProfile;
use App\Models\ReadinessCheck;
use App\Models\Tender;
use App\Models\TenderDecision;
use App\Models\User;
use App\Support\AuditLog;
use App\Support\Bid\BidWorkspace;
use App\Support\Bid\ChecklistBuilder;
use App\Support\Eligibility\EligibilityRunner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * M7 for real tenders: readiness check (VAL-01…07) and final sign-off (VAL-08).
 *
 * The issues are worked out in the browser by the same code as the sample screen,
 * from the data sent here; the server keeps the score history and the sign-off.
 */
class ValidationController extends Controller
{
    public function index(string $tender, EligibilityRunner $runner, BidWorkspace $bid, ChecklistBuilder $checklist): Response|RedirectResponse
    {
        $tender = Tender::with(['creator', 'documents' => fn ($q) => $q->withoutText()])->findOrFail($tender);
        $run = $runner->latestRun($tender);
        $decision = $this->decision($tender);
        if ($run === null || $decision?->outcome !== 'proceed') {
            return to_route('tenders.decision', $tender->id)
                ->with('error', 'Decide to bid first. The readiness check looks at the bid you are writing.');
        }

        $bid->ensure($tender);
        $checklist->sync($tender);
        if (in_array($tender->stage, [TenderStage::Compliance, TenderStage::Drafting], true)) {
            $tender->forceFill(['stage' => TenderStage::Validation])->save();
        }

        $profile = CompanyProfile::first();
        $items = ChecklistItem::where('tender_id', $tender->id)->orderBy('position')->get();
        $signer = $tender->signed_off_by !== null ? User::find($tender->signed_off_by) : null;

        return Inertia::render('tenders/live/validation', [
            'tender' => $tender->toFrontend(),
            'rows' => $runner->rows($run),
            'sections' => BidSection::where('tender_id', $tender->id)->orderBy('position')->get()->map->toFrontend()->values(),
            'decision' => $decision->toFrontend(),
            'items' => $items->map(fn (ChecklistItem $i) => $i->toFrontend($profile))->values(),
            'progress' => $items->mapWithKeys(fn (ChecklistItem $i) => [$i->id => (object) ($i->progress ?? [])]),
            'scoreHistory' => ReadinessCheck::where('tender_id', $tender->id)->orderBy('created_at')->orderBy('id')->get()->map->toFrontend()->values(),
            'signedOff' => $tender->signed_off_at === null ? null : [
                'by' => $signer->name ?? 'Former member',
                'at' => $tender->signed_off_at->toIso8601ZuluString(),
            ],
        ]);
    }

    /** VAL-07: keep each new result; a re-check by hand is always kept. */
    public function record(Request $request, string $tender): RedirectResponse
    {
        $tender = Tender::findOrFail($tender);
        $data = $request->validate([
            'score' => ['required', 'integer', 'min:0', 'max:100'],
            'critical' => ['required', 'integer', 'min:0', 'max:999'],
            'manual' => ['sometimes', 'boolean'],
        ]);
        $manual = (bool) ($data['manual'] ?? false);
        if ($manual) {
            Gate::authorize('edit-tenant-data');
        }

        $last = ReadinessCheck::where('tender_id', $tender->id)->latest('created_at')->latest('id')->first();
        $same = $last !== null && $last->score === $data['score'] && $last->critical === $data['critical'];
        if ($tender->signed_off_at === null && (! $same || $manual)) {
            ReadinessCheck::create([
                'tender_id' => $tender->id,
                'score' => $data['score'],
                'critical' => $data['critical'],
                'by_name' => $manual ? ($request->user()->name ?? 'ProcurPilot') : 'ProcurPilot',
                'manual' => $manual,
            ]);
        }

        return back();
    }

    /** VAL-08: an owner confirms the bid is ready. Not while critical issues remain. */
    public function signOff(Request $request, string $tender): RedirectResponse
    {
        Gate::authorize('manage-tenant');
        $tender = Tender::findOrFail($tender);
        abort_if($this->decision($tender)?->outcome !== 'proceed', 409, 'Decide to bid first.');

        $last = ReadinessCheck::where('tender_id', $tender->id)->latest('created_at')->latest('id')->first();
        if ($last === null || $last->critical > 0) {
            throw ValidationException::withMessages(['signoff' => 'Fix every critical issue, then sign off.']);
        }

        DB::transaction(function () use ($tender, $request, $last) {
            $tender->forceFill(['signed_off_at' => now(), 'signed_off_by' => $request->user()?->getKey(), 'stage' => TenderStage::Submitted])->save();
            AuditLog::record(AuditCategory::Signoff, 'signed off the bid for', $tender->label(), "Readiness {$last->score}%", $tender, $request->user(), $tender->id);
        });

        return back()->with('success', 'Bid signed off. Submit it to the buyer through their portal.');
    }

    public function undoSignOff(Request $request, string $tender): RedirectResponse
    {
        Gate::authorize('manage-tenant');
        $tender = Tender::findOrFail($tender);
        if ($tender->signed_off_at === null) {
            return back();
        }

        DB::transaction(function () use ($tender, $request) {
            $tender->forceFill(['signed_off_at' => null, 'signed_off_by' => null, 'stage' => TenderStage::Validation])->save();
            AuditLog::record(AuditCategory::Signoff, 'reopened the bid for', $tender->label(), 'Sign-off withdrawn', $tender, $request->user(), $tender->id);
        });

        return back()->with('success', 'Sign-off withdrawn. The bid can be edited again.');
    }

    private function decision(Tender $tender): ?TenderDecision
    {
        return TenderDecision::with('decider')->where('tender_id', $tender->id)->latest('created_at')->latest('id')->first();
    }
}
