<?php

namespace App\Support\Opportunities;

use App\Enums\BuyerType;
use Carbon\Carbon;
use Illuminate\Support\Str;

/**
 * Turns one OCDS release (the open-data format both UK feeds use) into the fields
 * of an Opportunity. Returns null for anything that isn't an open tender with a
 * deadline still to come.
 */
class ReleaseMapper
{
    /** ITL/NUTS region codes used by Find a Tender → the names Contracts Finder uses. */
    private const REGIONS = [
        'UKC' => 'North East', 'UKD' => 'North West', 'UKE' => 'Yorkshire and the Humber',
        'UKF' => 'East Midlands', 'UKG' => 'West Midlands', 'UKH' => 'East of England',
        'UKI' => 'London', 'UKJ' => 'South East', 'UKK' => 'South West',
        'UKL' => 'Wales', 'UKM' => 'Scotland', 'UKN' => 'Northern Ireland',
    ];

    /**
     * @param  array<string, mixed>  $r
     * @return array<string, mixed>|null
     */
    public function map(array $r, string $source): ?array
    {
        $t = $r['tender'] ?? null;
        $end = $t['tenderPeriod']['endDate'] ?? null;
        $title = trim((string) ($t['title'] ?? ''));
        $buyer = trim((string) ($r['buyer']['name'] ?? self::partyWithRole($r, 'buyer')['name'] ?? ''));
        if (! is_array($t) || ! $end || $title === '' || $buyer === '' || ($t['status'] ?? 'active') !== 'active') {
            return null;
        }

        try {
            $deadline = Carbon::parse($end)->utc();
        } catch (\Throwable) {
            return null;
        }
        if ($deadline->isPast()) {
            return null;
        }

        $docs = collect(self::rows($t['documents'] ?? null))->filter(fn (array $d) => ! empty($d['url']));
        $noticeUrl = $source === 'fts'
            ? 'https://www.find-tender.service.gov.uk/Notice/'.rawurlencode((string) $r['id'])
            : ($docs->first(fn ($d) => str_contains($d['url'], 'contractsfinder.service.gov.uk/Notice/') && ! str_contains($d['url'], '/Attachment/'))['url']
                ?? 'https://www.contractsfinder.service.gov.uk/Search');

        $description = trim(implode("\n\n", array_filter([
            $t['description'] ?? null,
            ...collect(self::rows($t['lots'] ?? null))->map(fn ($l) => isset($l['title']) ? 'Lot '.($l['id'] ?? '').': '.$l['title'].(isset($l['description']) ? ". {$l['description']}" : '') : null)->all(),
        ])));

        return [
            'source' => $source,
            'ocid' => (string) $r['ocid'],
            'notice_id' => (string) ($r['id'] ?? $r['ocid']),
            'match_key' => sha1(self::plain($title).'|'.self::plain($buyer)),
            'title' => Str::limit($title, 497),
            'description' => $description !== '' ? Str::limit($description, 20000) : null,
            'buyer_name' => Str::limit($buyer, 252),
            'buyer_type' => self::buyerType($buyer, $r)->value,
            'value' => self::value($t),
            'currency' => (string) ($t['value']['currency'] ?? 'GBP'),
            'deadline' => $deadline,
            'published_at' => isset($t['datePublished']) || isset($r['date']) ? Carbon::parse($t['datePublished'] ?? $r['date'])->utc() : null,
            'cpv' => $t['classification']['id'] ?? null,
            'cpv_label' => isset($t['classification']['description']) ? Str::limit($t['classification']['description'], 252) : null,
            'regions' => self::regions($t),
            'sme_suitable' => $t['suitability']['sme'] ?? null,
            'url' => $noticeUrl,
            'submission_url' => self::firstUrl([
                $t['submissionMethodDetails'] ?? null,
                ...$docs->filter(fn ($d) => ! str_contains($d['url'], 'contractsfinder.service.gov.uk'))->pluck('url')->all(),
                ...collect(self::rows($r['parties'] ?? null))->map(fn ($p) => $p['details']['buyerProfile'] ?? null)->all(),
            ]),
            'documents' => $docs
                ->reject(fn ($d) => $d['url'] === $noticeUrl)
                ->map(fn ($d) => [
                    'title' => Str::limit(trim((string) ($d['title'] ?? $d['description'] ?? 'Document')), 200),
                    'url' => (string) $d['url'],
                    'format' => $d['format'] ?? null,
                ])->values()->take(20)->all(),
            'award_criteria' => self::awardCriteria($t),
            'selection' => self::selection($t),
        ];
    }

    /** @param array<string, mixed> $t */
    private static function value(array $t): ?int
    {
        $amount = $t['value']['amount'] ?? $t['minValue']['amount'] ?? null;
        if ($amount === null) {
            $lots = collect(self::rows($t['lots'] ?? null))->sum(fn ($l) => (float) ($l['value']['amount'] ?? 0));
            $amount = $lots > 0 ? $lots : null;
        }

        return is_numeric($amount) && $amount > 0 ? (int) round((float) $amount) : null;
    }

    /**
     * @param  array<string, mixed>  $t
     * @return list<string>
     */
    private static function regions(array $t): array
    {
        $found = [];
        foreach ($t['items'] ?? [] as $item) {
            foreach ($item['deliveryAddresses'] ?? [] as $a) {
                $region = (string) ($a['region'] ?? '');
                if (preg_match('/^(UK[C-N])/', $region, $m)) {
                    $found[] = self::REGIONS[$m[1]];
                } elseif (in_array($region, self::REGIONS, true)) {
                    $found[] = $region;
                }
            }
        }

        return array_values(array_unique($found));
    }

    /**
     * Award criteria with their weights, the same across lots listed once.
     *
     * @param  array<string, mixed>  $t
     * @return list<array{name: string, type: string, weight: int|null}>
     */
    private static function awardCriteria(array $t): array
    {
        $criteria = [];
        foreach ([$t['awardCriteria'] ?? null, ...array_map(fn ($l) => $l['awardCriteria'] ?? null, $t['lots'] ?? [])] as $set) {
            foreach ($set['criteria'] ?? [] as $c) {
                $type = (string) ($c['type'] ?? 'quality');
                $name = trim((string) ($c['name'] ?? ($type === 'price' ? 'Price' : ($type === 'cost' ? 'Cost' : ''))));
                if ($name === '') {
                    continue;
                }
                $desc = (string) ($c['description'] ?? '');
                $weight = preg_match('/^\s*(\d{1,3})(?:\.\d+)?\s*%?\s*$/', $desc, $m) ? (int) $m[1]
                    : (isset($c['numbers'][0]['number']) && is_numeric($c['numbers'][0]['number']) ? (int) $c['numbers'][0]['number'] : null);
                $criteria[strtolower($name)] ??= ['name' => Str::limit($name, 200), 'type' => $type, 'weight' => $weight];
            }
        }

        return array_values($criteria);
    }

    /**
     * What suppliers must show, as the buyer wrote it.
     *
     * @param  array<string, mixed>  $t
     * @return list<string>
     */
    private static function selection(array $t): array
    {
        $out = [];
        $sets = [$t['selectionCriteria'] ?? null, ...array_map(fn ($l) => $l['selectionCriteria'] ?? null, $t['lots'] ?? [])];
        foreach ($sets as $set) {
            foreach ($set['criteria'] ?? [] as $c) {
                foreach ([$c['description'] ?? null, $c['minimum'] ?? null] as $text) {
                    $text = trim((string) $text);
                    if (mb_strlen($text) >= 15 && ! self::onlyPointsElsewhere($text)) {
                        $out[md5($text)] = Str::limit($text, 3000);
                    }
                }
            }
        }
        if (is_string($t['otherRequirements']['reservedParticipation'] ?? null)) {
            $out[] = $t['otherRequirements']['reservedParticipation'];
        }

        return array_values($out);
    }

    /** "As detailed in the quotation pack", "Please refer to the ITT": says nothing itself. */
    public static function onlyPointsElsewhere(string $text): bool
    {
        return mb_strlen($text) < 160
            && (bool) preg_match('/^\W*(please\s+)?(refer\s+to|see|as\s+(detailed|set\s+out|described|stated|specified|outlined)\s+in|as\s+per|in\s+accordance\s+with|details?\s+(are\s+)?(in|within)|refer)\b/i', $text);
    }

    /** @param array<string, mixed> $r */
    private static function buyerType(string $name, array $r): BuyerType
    {
        $n = strtolower($name);
        $type = collect(self::rows(self::partyWithRole($r, 'buyer')['details']['classifications'] ?? null))->firstWhere('scheme', 'TED_CA_TYPE');
        $ca = strtoupper(is_array($type) ? (string) ($type['id'] ?? '') : '');

        return match (true) {
            (bool) preg_match('/\bnhs\b|hospital|health|\bics\b|integrated care|ambulance/', $n) => BuyerType::Nhs,
            (bool) preg_match('/school|college|university|academy|education|learning trust/', $n) => BuyerType::Education,
            (bool) preg_match('/council|borough|county|district|city of|combined authority|fire and rescue|police and crime/', $n) || str_contains($ca, 'REGIONAL') || str_contains($ca, 'LOCAL') => BuyerType::Local,
            (bool) preg_match('/^(scottish|welsh)\b|\bscotland\b|\bwales\b|northern ireland|\bni\b/', $n) => BuyerType::Devolved,
            (bool) preg_match('/\b(ltd|limited|plc|llp)\b/', $n) && ! preg_match('/housing association/', $n) => BuyerType::Private,
            default => BuyerType::Central,
        };
    }

    /**
     * @param  array<string, mixed>  $r
     * @return array<string, mixed>
     */
    private static function partyWithRole(array $r, string $role): array
    {
        foreach ($r['parties'] ?? [] as $p) {
            if (in_array($role, $p['roles'] ?? [], true)) {
                return $p;
            }
        }

        return [];
    }

    /**
     * The feeds are untrusted JSON: keep only the entries that are objects.
     *
     * @return list<array<string, mixed>>
     */
    private static function rows(mixed $v): array
    {
        return is_array($v) ? array_values(array_filter($v, 'is_array')) : [];
    }

    /** @param list<mixed> $candidates */
    private static function firstUrl(array $candidates): ?string
    {
        foreach ($candidates as $c) {
            if (is_string($c) && preg_match('#^https?://\S+$#i', trim($c))) {
                return Str::limit(trim($c), 990, '');
            }
        }

        return null;
    }

    private static function plain(string $s): string
    {
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', strtolower(Str::ascii($s))));
    }
}
