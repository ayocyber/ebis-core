<?php

namespace App\Support\Opportunities;

use App\Models\CompanyProfile;
use App\Models\Opportunity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Finds open tenders for a company by its keywords (or a one-off search), with
 * filters. Each result says which words matched, so the ranking is explainable.
 */
class OpportunitySearch
{
    private const STOP = ['and', 'the', 'for', 'with', 'services', 'service', 'solutions', 'ltd', 'limited', 'company', 'other', 'general', 'related'];

    /**
     * Words that pick out tenders for a company, from its sector, until it sets its own.
     *
     * @return list<string>
     */
    public static function defaultKeywords(CompanyProfile $profile): array
    {
        $sector = (string) $profile->sector;
        $words = [];
        foreach (preg_split('/[^A-Za-z&-]+/', $sector) ?: [] as $w) {
            if (mb_strlen($w) >= 3 && ! in_array(strtolower($w), self::STOP, true)) {
                $words[] = strtolower($w);
            }
        }
        if (preg_match('/\b(IT|ICT|technology|digital|software)\b/', $sector)) {
            array_push($words, 'IT services', 'IT support', 'software', 'digital', 'cyber');
        }

        return array_slice(array_values(array_unique($words)), 0, 10);
    }

    /**
     * @param  list<string>  $keywords
     * @param  array{q?: string|null, region?: string|null, min?: int|null, max?: int|null, days?: int|null, sme?: bool, sort?: string|null}  $filters
     * @return Collection<int, array{opportunity: Opportunity, matched: list<string>, score: int}>
     */
    public function search(array $keywords, array $filters): Collection
    {
        $q = trim((string) ($filters['q'] ?? ''));
        $terms = $q !== '' ? [$q] : $keywords;
        $terms = array_values(array_filter(array_map('trim', $terms), fn (string $t) => mb_strlen($t) >= 3));

        $query = Opportunity::query()->where('deadline', '>', now());
        if ($terms !== []) {
            $query->where(function (Builder $w) use ($terms) {
                foreach ($terms as $t) {
                    $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($t)).'%';
                    $w->orWhereRaw('lower(title) like ?', [$like])
                        ->orWhereRaw('lower(description) like ?', [$like])
                        ->orWhereRaw('lower(cpv_label) like ?', [$like]);
                }
            });
        }
        if (! empty($filters['region'])) {
            // A JSON column: compared as text so it works on Postgres and SQLite alike.
            $query->whereRaw('cast(regions as text) like ?', ['%"'.str_replace(['%', '_', '"'], '', $filters['region']).'"%']);
        }
        if (! empty($filters['min'])) {
            $query->where('value', '>=', $filters['min']);
        }
        if (! empty($filters['max'])) {
            $query->where('value', '<=', $filters['max']);
        }
        if (! empty($filters['days'])) {
            $query->where('deadline', '<=', now()->addDays($filters['days']));
        }
        if (! empty($filters['sme'])) {
            $query->where('sme_suitable', true);
        }

        $results = $query->orderBy('deadline')->limit(400)->get()
            ->map(fn (Opportunity $o) => ['opportunity' => $o, ...self::score($o, $terms)])
            // The database match is loose ("it" inside "with"); keep whole-word matches.
            ->filter(fn (array $r) => $terms === [] || $r['matched'] !== []);

        $sorted = match ($filters['sort'] ?? 'match') {
            'closing' => $results->sortBy(fn (array $r) => $r['opportunity']->deadline->getTimestamp()),
            'newest' => $results->sortByDesc(fn (array $r) => $r['opportunity']->published_at?->getTimestamp() ?? 0),
            'value' => $results->sortByDesc(fn (array $r) => $r['opportunity']->value ?? 0),
            default => $results->sortByDesc(fn (array $r) => $r['score'] * 1_000_000_000 - $r['opportunity']->deadline->getTimestamp() / 1000),
        };

        return $sorted->values();
    }

    /**
     * Title matches count most; the description and category less.
     *
     * @param  list<string>  $terms
     * @return array{matched: list<string>, score: int}
     */
    private static function score(Opportunity $o, array $terms): array
    {
        $matched = [];
        $score = 0;
        foreach ($terms as $t) {
            $re = '/(?<![A-Za-z0-9])'.preg_quote($t, '/').'(?![A-Za-z0-9])/i';
            $hit = 0;
            if (preg_match($re, $o->title)) {
                $hit += 5;
            }
            if (preg_match($re, (string) $o->cpv_label)) {
                $hit += 3;
            }
            if ($o->description !== null && preg_match_all($re, $o->description) > 0) {
                $hit += min(3, (int) preg_match_all($re, $o->description));
            }
            if ($hit > 0) {
                $matched[] = $t;
                $score += $hit;
            }
        }

        return ['matched' => $matched, 'score' => $score];
    }
}
