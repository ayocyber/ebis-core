<?php

namespace App\Support\Opportunities;

use App\Models\Opportunity;
use Carbon\Carbon;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Pulls open tenders from the two free UK government feeds (OCDS format):
 * Find a Tender (larger contracts) and Contracts Finder (smaller ones, often
 * SME-friendly). Each run picks up where the last one stopped.
 */
class OpportunityFeed
{
    public const FEEDS = [
        // Find a Tender's own stages=tender filter drops the link to the next page,
        // so read everything and keep the open tenders here (ReleaseMapper).
        'fts' => 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100&updatedFrom=',
        'cf' => 'https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?stages=tender&limit=100&publishedFrom=',
    ];

    /** Keeps a free server and database safe from a huge first run. */
    private const MAX_PAGES = 60;

    /** Pause between pages; tests set it to 0. */
    public static int $pauseMs = 3000;

    public function __construct(private ReleaseMapper $mapper) {}

    /**
     * @return array<string, array{saved: int, error: string|null}>
     */
    public function fetch(int $days = 14): array
    {
        $results = [];
        foreach (self::FEEDS as $source => $base) {
            $results[$source] = $this->fetchSource($source, $base, $days);
        }
        $this->prune();
        Cache::forever('opportunities:fetched_at', now()->toIso8601String());

        return $results;
    }

    public static function lastFetchedAt(): ?Carbon
    {
        $at = Cache::get('opportunities:fetched_at');

        return is_string($at) ? Carbon::parse($at) : null;
    }

    /**
     * @return array{saved: int, error: string|null}
     */
    private function fetchSource(string $source, string $base, int $days): array
    {
        $key = "opportunities:{$source}:since";
        $since = Cache::get($key);
        $from = is_string($since) ? Carbon::parse($since)->subHour() : now()->subDays($days);
        // A run that was stopped (e.g. rate limited) carries on from the page it reached.
        $resume = Cache::get("{$key}:resume");
        $startedAt = is_array($resume) ? Carbon::parse($resume['started']) : now();
        $url = is_array($resume) ? $resume['url'] : $base.$from->utc()->format('Y-m-d\TH:i:s');
        $saved = 0;

        try {
            for ($page = 0; $url !== null && $page < self::MAX_PAGES; $page++) {
                if ($page > 0) {
                    usleep(self::$pauseMs * 1000); // the feeds rate-limit busy clients
                }
                $json = Http::timeout(60)
                    ->retry(2, 3000, fn (Throwable $e) => ! ($e instanceof RequestException && $e->response->status() === 429))
                    ->acceptJson()
                    ->withUserAgent('ProcurPilot tender search')
                    ->get($url)->throw()->json();
                foreach ($json['releases'] ?? [] as $release) {
                    try {
                        $saved += $this->save($release, $source) ? 1 : 0;
                    } catch (Throwable $e) {
                        // One odd notice must not stop the rest.
                        Log::warning("Skipped {$source} notice ".($release['ocid'] ?? '?').": {$e->getMessage()}");
                    }
                }
                $next = $json['links']['next'] ?? null;
                $url = is_string($next) && $next !== $url && ($json['releases'] ?? []) !== [] ? $next : null;
            }
        } catch (Throwable $e) {
            Log::warning("Tender feed {$source} failed: {$e->getMessage()}");
            Cache::put("{$key}:resume", ['url' => $url, 'started' => $startedAt->toIso8601String()], now()->addHours(12));

            return ['saved' => $saved, 'error' => $e instanceof RequestException && $e->response->status() === 429 ? 'rate limited, carries on next run' : $e->getMessage()];
        }

        // Only move forward once the whole window was read.
        if ($url === null) {
            Cache::forever($key, $startedAt->toIso8601String());
            Cache::forget("{$key}:resume");
        } else {
            Cache::put("{$key}:resume", ['url' => $url, 'started' => $startedAt->toIso8601String()], now()->addHours(12));
        }

        return ['saved' => $saved, 'error' => null];
    }

    /** @param array<string, mixed> $release */
    public function save(array $release, string $source): bool
    {
        $data = isset($release['ocid']) ? $this->mapper->map($release, $source) : null;
        if ($data === null) {
            // A tender that was cancelled or closed early comes off the list.
            if (isset($release['ocid']) && in_array($release['tender']['status'] ?? null, ['cancelled', 'unsuccessful', 'complete', 'withdrawn'], true)) {
                Opportunity::where('ocid', $release['ocid'])->delete();
            }

            return false;
        }

        // The same tender on both sites is listed once, preferring Find a Tender.
        $twin = Opportunity::where('match_key', $data['match_key'])->where('ocid', '!=', $data['ocid'])->first();
        if ($twin !== null) {
            if ($source === 'cf' && $twin->source === 'fts') {
                return false;
            }
            $twin->delete();
        }

        Opportunity::updateOrCreate(['ocid' => $data['ocid']], $data);

        return true;
    }

    /** Tenders whose deadline has passed are no use to anyone. */
    private function prune(): void
    {
        Opportunity::where('deadline', '<', now())->delete();
    }
}
