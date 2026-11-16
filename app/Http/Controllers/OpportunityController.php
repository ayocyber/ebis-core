<?php

namespace App\Http\Controllers;

use App\Models\CompanyProfile;
use App\Models\Opportunity;
use App\Models\Tender;
use App\Models\User;
use App\Support\Opportunities\OpportunityFeed;
use App\Support\Opportunities\OpportunitySearch;
use App\Support\Opportunities\OpportunityTenders;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Find tenders: open opportunities from Find a Tender and Contracts Finder,
 * matched to the company, and "Bid for this" to start one.
 */
class OpportunityController extends Controller
{
    private const PER_PAGE = 25;

    public function index(Request $request, OpportunitySearch $search): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'region' => ['nullable', 'string', 'max:40'],
            'min' => ['nullable', 'integer', 'min:0'],
            'max' => ['nullable', 'integer', 'min:0'],
            'days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'sme' => ['nullable', 'boolean'],
            'all' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:match,closing,newest,value'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $profile = CompanyProfile::current();
        $keywords = $profile->tender_keywords ?? OpportunitySearch::defaultKeywords($profile);
        $results = $search->search(empty($filters['all']) ? $keywords : [], $filters);
        $page = (int) ($filters['page'] ?? 1);

        // Tenders this company already started from the feeds.
        $started = Tender::whereNotNull('source_url')->pluck('id', 'source_url');

        $fetchedAt = OpportunityFeed::lastFetchedAt();
        // The free server sleeps, so the hourly fetch may not have run: catch up after this page is sent.
        if ($fetchedAt === null || $fetchedAt->lt(now()->subHour())) {
            if (Cache::add('opportunities:fetching', true, now()->addMinutes(10))) {
                dispatch(function () {
                    try {
                        app(OpportunityFeed::class)->fetch();
                    } finally {
                        Cache::forget('opportunities:fetching');
                    }
                })->afterResponse();
            }
        }

        return Inertia::render('tenders/find', [
            'results' => $results->forPage($page, self::PER_PAGE)->map(fn (array $r) => [
                ...self::toFrontend($r['opportunity']),
                'matched' => $r['matched'],
                'tenderId' => $started[$r['opportunity']->url] ?? null,
            ])->values(),
            'total' => $results->count(),
            'page' => $page,
            'pages' => max(1, (int) ceil($results->count() / self::PER_PAGE)),
            'filters' => $filters,
            'keywords' => $keywords,
            'keywordsAreDefault' => $profile->tender_keywords === null,
            'openCount' => Opportunity::where('deadline', '>', now())->count(),
            'fetchedAt' => $fetchedAt?->toIso8601ZuluString(),
            'fetching' => Cache::has('opportunities:fetching'),
        ]);
    }

    public function keywords(Request $request): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $data = $request->validate([
            'keywords' => ['present', 'array', 'max:20'],
            'keywords.*' => ['string', 'min:3', 'max:40'],
        ], ['keywords.*.min' => 'Each search word needs at least 3 letters.']);

        $profile = CompanyProfile::current();
        $profile->forceFill([
            'tender_keywords' => array_values(array_unique(array_map(fn (string $k) => trim($k), $data['keywords']))),
        ])->save();

        return back()->with('success', 'Search words saved.');
    }

    public function bid(Request $request, string $opportunity, OpportunityTenders $tenders): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $o = Opportunity::findOrFail($opportunity);
        abort_if($o->deadline->isPast(), 410, 'This tender has closed.');

        $existing = OpportunityTenders::existing($o);
        if ($existing !== null) {
            return to_route('tenders.show', $existing->id)->with('success', 'You already started this tender.');
        }

        /** @var User $user */
        $user = $request->user();
        $tender = $tenders->start($o, $user);
        $attached = $tender->documents()->count() - 1;

        $message = "{$tender->title} added from {$o->sourceName()}. The notice was read for requirements";
        $message .= $attached > 0 ? ", with {$attached} attached document".($attached > 1 ? 's' : '').'.' : '.';
        if ($tenders->notFetched > 0 || $o->submission_url) {
            $message .= ' The full tender pack is on the buyer’s portal: download it and add it here.';
        }

        return to_route('tenders.show', $tender->id)->with('success', $message);
    }

    /**
     * @return array<string, mixed>
     */
    private static function toFrontend(Opportunity $o): array
    {
        return [
            'id' => $o->id,
            'source' => $o->sourceName(),
            'noticeId' => $o->notice_id,
            'title' => $o->title,
            'summary' => $o->description ? mb_strimwidth((string) preg_replace('/\s+/', ' ', $o->description), 0, 420, '…') : '',
            'buyer' => ['name' => $o->buyer_name, 'type' => $o->buyer_type->value],
            'value' => $o->value,
            'currency' => $o->currency,
            'deadline' => $o->deadline->toIso8601ZuluString(),
            'publishedAt' => $o->published_at?->toIso8601ZuluString(),
            'category' => $o->cpv_label,
            'regions' => $o->regions ?? [],
            'sme' => $o->sme_suitable,
            'url' => $o->url,
            'portalUrl' => $o->submission_url,
            'documents' => count($o->documents ?? []),
            'awardCriteria' => $o->award_criteria ?? [],
            'selection' => array_map(fn (string $s) => mb_strimwidth($s, 0, 300, '…'), array_slice($o->selection ?? [], 0, 4)),
        ];
    }
}
