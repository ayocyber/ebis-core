<?php

namespace App\Support\Requirements;

use App\Enums\RequirementCategory;
use App\Enums\RequirementTopic;
use Illuminate\Support\Str;

/**
 * Finds sentences in a tender's text that read like requirements ("must", "shall",
 * "minimum", "at least"…) and suggests them for the user to confirm (TUN-01/02).
 *
 * Plain pattern matching, no AI: it misses requirements phrased unusually and the
 * user confirms every one. Where a sentence names a hard criterion (turnover,
 * insurance cover, a certificate, years trading) it also proposes the rule that
 * checks it (ELG-01).
 */
class RequirementFinder
{
    private const TRIGGER = '/\b(must|shall|required|requirement|mandatory|minimum|at least|no less than|not less than|need to|needs to|expected to)\b/i';

    /** A heading after which numbered clauses are criteria even without "must". */
    private const CRITERIA_HEADING = '/\b(selection criteria|minimum (?:requirements|standards)|mandatory (?:requirements|criteria)|essential requirements|exclusion grounds|qualification criteria)\b/i';

    private const STRONG = '/\b(must|shall|required|mandatory|minimum|at least|no less than|not less than|pass\/fail|pass or fail)\b/i';

    private const SCORED = '/\b(scored|marks?|weighting|weighted|evaluated|evaluation criteria|quality score)\b/i';

    private const MONEY = '(?:£|GBP\s?)\s?([\d][\d,]*(?:\.\d+)?)\s*(m\b|million|k\b|thousand)?';

    /**
     * @return list<FoundRequirement>
     */
    public function find(string $text): array
    {
        $found = [];
        $underCriteria = false;
        foreach (explode("\f", $text) as $i => $page) {
            foreach ($this->sentences($page) as $sentence) {
                // "4. Selection criteria" turns the numbered clauses after it into requirements.
                if (mb_strlen($sentence) <= 80 && preg_match(self::CRITERIA_HEADING, $sentence) && ! preg_match(self::TRIGGER, $sentence)) {
                    $underCriteria = true;

                    continue;
                }
                array_push($found, ...$this->fromSentence($sentence, $i + 1, $underCriteria));
            }
        }

        // The same sentence repeated across documents is suggested once.
        $unique = [];
        foreach ($found as $f) {
            $unique[$f->key ?? $f->quote] ??= $f;
        }

        return array_values($unique);
    }

    /**
     * @return list<string>
     */
    private function sentences(string $page): array
    {
        $text = (string) preg_replace('/\s+/u', ' ', $page);
        // Break after full stops (but not after a clause number like "1.") and before
        // numbered clauses ("1. …", "4.2 …"), so each clause keeps its number.
        $parts = preg_split(
            '/(?<=[.;!?])(?<!\b\d\.)(?<!\b\d\d\.)\s+(?=[A-Z(])|\s+(?=\d{1,2}(?:\.\d{1,2}){0,3}\.?\s+[A-Z])/u',
            $text,
        ) ?: [];

        return array_values(array_filter(array_map('trim', $parts), fn (string $s) => mb_strlen($s) >= 12 && mb_strlen($s) <= 600));
    }

    /**
     * @return list<FoundRequirement>
     */
    private function fromSentence(string $sentence, int $page, bool $underCriteria): array
    {
        $section = null;
        $body = $sentence;
        if (preg_match('/^(\d{1,2}(?:\.\d{1,2}){0,3})\.?\s+(.*)$/u', $sentence, $m)) {
            $section = $m[1];
            $body = $m[2];
        }

        $criterion = $underCriteria && $section !== null;
        if (mb_strlen($body) < 25 || (! $criterion && ! preg_match(self::TRIGGER, $body))) {
            return [];
        }

        $category = match (true) {
            $criterion, (bool) preg_match('/pass\/fail|pass or fail/i', $body) => RequirementCategory::Mandatory,
            (bool) preg_match(self::SCORED, $body) => RequirementCategory::Scored,
            (bool) preg_match(self::STRONG, $body) => RequirementCategory::Mandatory,
            default => RequirementCategory::Informational,
        };
        $topic = $this->topic($body);

        // One sentence can set several insurance levels; each becomes its own requirement.
        $insurance = $this->insuranceChecks($body);
        if (count($insurance) > 1) {
            return array_map(fn (array $c) => new FoundRequirement(
                title: self::insuranceTitle($c),
                text: $body,
                category: $category,
                topic: RequirementTopic::Insurance,
                page: $page,
                section: $section,
                quote: $sentence,
                key: $sentence.'#'.$c['kind'],
                check: $c,
            ), $insurance);
        }

        return [new FoundRequirement(
            title: self::title($body),
            text: $body,
            category: $category,
            topic: $insurance !== [] ? RequirementTopic::Insurance : $topic,
            page: $page,
            section: $section,
            quote: $sentence,
            check: $insurance[0] ?? $this->check($body, $topic),
        )];
    }

    private function topic(string $s): RequirementTopic
    {
        return match (true) {
            (bool) preg_match('/\b(turnover|accounts|financial standing|credit|revenue|bank reference)\b/i', $s) => RequirementTopic::Financial,
            (bool) preg_match('/\binsurance|liability|indemnity\b/i', $s) => RequirementTopic::Insurance,
            (bool) preg_match('/\b(ISO|Cyber Essentials|certif\w*|accredit\w*|Toolkit|DSPT)\b/i', $s) => RequirementTopic::Certification,
            (bool) preg_match('/\b(experience|similar (scope|contracts?)|case stud\w*|references?|track record|delivered)\b/i', $s) => RequirementTopic::Experience,
            (bool) preg_match('/\b(DBS|clearance|vetting|staff|engineers?|personnel|qualified|qualifications?|CVs?)\b/i', $s) => RequirementTopic::Personnel,
            (bool) preg_match('/\b(social value|carbon|net zero|sustainab\w*|apprentice\w*|local spend)\b/i', $s) => RequirementTopic::SocialValue,
            (bool) preg_match('/\b(submit\w*|submission|portal|late|deadline|page limit|word limit|font|format|clarification)\b/i', $s) => RequirementTopic::Submission,
            (bool) preg_match('/\b(GDPR|data protection|modern slavery|legal|regulation|law|Act)\b/i', $s) => RequirementTopic::Legal,
            default => RequirementTopic::Technical,
        };
    }

    /**
     * @return array<string, mixed>|null
     */
    private function check(string $s, RequirementTopic $topic): ?array
    {
        if ($topic === RequirementTopic::Financial && preg_match('/turnover/i', $s) && ($amount = self::money($s)) !== null) {
            return ['type' => 'turnover_min', 'amount' => $amount, 'years' => self::count($s, '(?:financial )?years?') ?? 1];
        }

        if (preg_match('/Cyber Essentials\s*(Plus|\+)/i', $s)) {
            return ['type' => 'certification', 'name' => 'Cyber Essentials Plus'];
        }
        if (preg_match('/Cyber Essentials/i', $s)) {
            return ['type' => 'certification', 'name' => 'Cyber Essentials'];
        }
        if (preg_match('/ISO(?:\/IEC)?\s?(\d{4,5})/i', $s, $m)) {
            return ['type' => 'certification', 'name' => "ISO {$m[1]}"];
        }

        if (preg_match('/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\'?\s+(?:of\s+)?trading|trading for (?:at least )?(\d+|two|three|five) years/i', $s, $m)) {
            return ['type' => 'years_trading', 'years' => self::number($m[1] ?: $m[2])];
        }

        if ($topic === RequirementTopic::Experience && preg_match('/(\d+|one|two|three|four|five)\s+(?:contracts?|case stud\w*|references?|projects?)/i', $s, $m)) {
            return ['type' => 'vault_documents', 'category' => 'experience', 'count' => self::number($m[1])];
        }

        return null;
    }

    /**
     * @return list<array{type: string, kind: string, amount: int}>
     */
    private function insuranceChecks(string $s): array
    {
        preg_match_all('/(public liability|employer\'?s?\'?\s+liability|professional indemnity)[^£\d]{0,60}?'.self::MONEY.'/i', $s, $all, PREG_SET_ORDER);

        $checks = [];
        foreach ($all as $m) {
            $kind = match (true) {
                stripos($m[1], 'public') !== false => 'public',
                stripos($m[1], 'employer') !== false => 'employers',
                default => 'professional',
            };
            $checks[$kind] ??= ['type' => 'insurance_min', 'kind' => $kind, 'amount' => self::toAmount($m[2], $m[3] ?? '')];
        }

        return array_values($checks);
    }

    private static function money(string $s): ?int
    {
        return preg_match('/'.self::MONEY.'/i', $s, $m) ? self::toAmount($m[1], $m[2] ?? '') : null;
    }

    private static function toAmount(string $number, string $unit): int
    {
        $value = (float) str_replace(',', '', $number);

        return (int) round($value * match (strtolower($unit)) {
            'm', 'million' => 1_000_000,
            'k', 'thousand' => 1_000,
            default => 1,
        });
    }

    private static function count(string $s, string $noun): ?int
    {
        return preg_match('/\b(\d+|one|two|three|four|five)\s+(?:last\s+)?'.$noun.'/i', $s, $m)
            || preg_match('/\blast\s+(\d+|one|two|three|four|five)\s+'.$noun.'/i', $s, $m)
            ? self::number($m[1])
            : null;
    }

    private static function number(string $word): int
    {
        return is_numeric($word) ? (int) $word : match (strtolower($word)) {
            'one' => 1, 'two' => 2, 'three' => 3, 'four' => 4, 'five' => 5,
            'six' => 6, 'seven' => 7, 'eight' => 8, 'nine' => 9, 'ten' => 10,
            default => 1,
        };
    }

    private static function title(string $body): string
    {
        $title = rtrim($body, ' .;:');

        return Str::limit(Str::ucfirst($title), 110, '…', preserveWords: true);
    }

    /**
     * @param  array{kind: string, amount: int}  $c
     */
    private static function insuranceTitle(array $c): string
    {
        $label = ['public' => 'Public liability', 'employers' => 'Employer’s liability', 'professional' => 'Professional indemnity'][$c['kind']];

        return "{$label} insurance of at least £".number_format($c['amount']);
    }
}
