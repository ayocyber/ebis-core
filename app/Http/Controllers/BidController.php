<?php

namespace App\Http\Controllers;

use App\Enums\AuditCategory;
use App\Enums\TenderStage;
use App\Models\BidSection;
use App\Models\BidSectionVersion;
use App\Models\Requirement;
use App\Models\Tender;
use App\Models\TenderDecision;
use App\Models\User;
use App\Support\AuditLog;
use App\Support\Bid\BidWorkspace;
use App\Support\Eligibility\EligibilityRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * M6 for real tenders: the compliance matrix (BID-01) and writing the bid by hand
 * with citations and versions (BID-03, BID-05). AI drafting is not part of this.
 */
class BidController extends Controller
{
    public function compliance(string $tender, EligibilityRunner $runner, BidWorkspace $bid): Response|RedirectResponse
    {
        return $this->page('tenders/live/compliance', $tender, $runner, $bid);
    }

    public function bid(string $tender, EligibilityRunner $runner, BidWorkspace $bid): Response|RedirectResponse
    {
        return $this->page('tenders/live/bid', $tender, $runner, $bid, withVersions: true);
    }

    public function storeSection(Request $request, string $tender): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);
        $data = $request->validate(['title' => ['required', 'string', 'min:2', 'max:255'], 'word_limit' => ['nullable', 'integer', 'min:1', 'max:100000']]);

        $section = BidSection::create([
            ...$data,
            'tender_id' => $tender->id,
            'requirement_ids' => [],
            'position' => (int) BidSection::where('tender_id', $tender->id)->max('position') + 1,
        ]);
        AuditLog::record(AuditCategory::Bid, 'added a section to', $tender->label(), $section->title, $section, $request->user(), $tender->id);

        return back()->with('success', 'Section added.');
    }

    /** Autosave from the editor (JSON), or a form (redirect). Status changes are logged. */
    public function updateSection(Request $request, string $tender, string $section): JsonResponse|RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $section = $this->section($tender, $section);
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'min:2', 'max:255'],
            'body' => ['sometimes', 'nullable', 'string', 'max:200000'],
            'status' => ['sometimes', Rule::in(array_keys(BidSection::STATUSES))],
            'assignee' => ['sometimes', 'nullable', 'string', 'max:120'],
            'word_limit' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100000'],
        ]);

        $from = $section->status;
        $section->fill($data)->save();

        if ($section->wasChanged('status')) {
            AuditLog::record(AuditCategory::Bid, 'changed a section’s status in', $section->title,
                BidSection::STATUSES[$from].' → '.BidSection::STATUSES[$section->status], $section, $request->user(), $section->tender_id);
        }

        return $request->wantsJson() ? response()->json(['section' => $section->toFrontend()]) : back();
    }

    public function destroySection(Request $request, string $tender, string $section): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $section = $this->section($tender, $section);
        DB::transaction(function () use ($section, $request) {
            $section->delete();
            AuditLog::record(AuditCategory::Bid, 'removed a section from', $section->title, null, $section, $request->user(), $section->tender_id);
        });

        return back()->with('success', 'Section removed. Its requirements are now unmapped.');
    }

    public function map(Request $request, string $tender, BidWorkspace $bid): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);
        $data = $request->validate(['requirement_id' => ['required', 'uuid'], 'section_id' => ['nullable', 'uuid']]);
        $req = Requirement::confirmed()->where('tender_id', $tender->id)->findOrFail($data['requirement_id']);
        $to = $data['section_id'] ? BidSection::where('tender_id', $tender->id)->findOrFail($data['section_id']) : null;

        /** @var User $user */
        $user = $request->user();
        $bid->map($tender, $req, $to, $user);

        return back();
    }

    public function saveVersion(Request $request, string $tender, string $section, BidWorkspace $bid): JsonResponse
    {
        Gate::authorize('edit-tenant-data');
        $section = $this->section($tender, $section);
        $data = $request->validate(['label' => ['required', 'string', 'max:120'], 'body' => ['sometimes', 'nullable', 'string', 'max:200000']]);
        if (array_key_exists('body', $data)) {
            $section->forceFill(['body' => $data['body']])->save();
        }

        /** @var User $user */
        $user = $request->user();
        $version = $bid->saveVersion($section, $data['label'], $user);

        return response()->json(['version' => $version?->toFrontend()]);
    }

    public function restore(Request $request, string $tender, string $section, string $version, BidWorkspace $bid): JsonResponse
    {
        Gate::authorize('edit-tenant-data');
        $section = $this->section($tender, $section);
        $version = BidSectionVersion::where('section_id', $section->id)->findOrFail($version);

        /** @var User $user */
        $user = $request->user();
        $bid->restore($section, $version, $user);

        return response()->json([
            'section' => $section->fresh()?->toFrontend(),
            'versions' => $section->versions()->get()->map->toFrontend()->values(),
        ]);
    }

    /**
     * The bid stage needs an eligibility check and a decision to bid (DEC-04).
     */
    private function page(string $component, string $tender, EligibilityRunner $runner, BidWorkspace $bid, bool $withVersions = false): Response|RedirectResponse
    {
        $tender = Tender::with(['creator', 'documents' => fn ($q) => $q->withoutText()])->findOrFail($tender);
        $run = $runner->latestRun($tender);
        $decision = TenderDecision::where('tender_id', $tender->id)->latest('created_at')->latest('id')->first();

        if ($run === null || $decision?->outcome !== 'proceed') {
            return to_route('tenders.decision', $tender->id)
                ->with('error', 'Decide to bid first. Writing the bid starts after the Go / No-Go decision.');
        }

        $bid->ensure($tender);
        if ($withVersions && $tender->stage === TenderStage::Compliance) {
            // Opening the editor means writing has started.
            $tender->forceFill(['stage' => TenderStage::Drafting])->save();
        }
        $sections = BidSection::with($withVersions ? ['versions'] : [])->where('tender_id', $tender->id)->orderBy('position')->get();

        return Inertia::render($component, array_filter([
            'tender' => $tender->toFrontend(),
            'rows' => $runner->rows($run),
            'sections' => $sections->map->toFrontend()->values(),
            'versions' => $withVersions
                ? $sections->mapWithKeys(fn (BidSection $s) => [$s->id => $s->versions->map->toFrontend()->values()])
                : null,
        ], fn ($v) => $v !== null));
    }

    private function section(string $tender, string $section): BidSection
    {
        $tender = Tender::findOrFail($tender);

        return BidSection::where('tender_id', $tender->id)->findOrFail($section);
    }
}
