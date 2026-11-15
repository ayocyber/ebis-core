<?php

namespace App\Support\Eligibility;

use App\Enums\AssessmentStatus as S;
use App\Enums\VaultCategory;
use App\Models\CompanyProfile;
use App\Models\Requirement;
use App\Models\VaultDocument;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Checks one requirement against the company (ELG-01…03, EVD-02/03).
 *
 * Deterministic: the same requirement, profile and vault always give the same
 * result. Missing data gives "Unknown", never a guess (ELG-03). Evidence that
 * expires before the deadline downgrades to "Partially met" (EVD-02).
 */
class EligibilityChecker
{
    /**
     * @param  Collection<int, VaultDocument>  $vault  Current documents with `facts` loaded
     */
    public function __construct(
        private ?CompanyProfile $profile,
        private Collection $vault,
        private Carbon $deadline,
    ) {}

    public function check(Requirement $req): Outcome
    {
        $rule = $req->check_rule;

        return match ($rule['type'] ?? null) {
            'turnover_min' => $this->turnover((int) $rule['amount'], (int) ($rule['years'] ?? 1)),
            'insurance_min' => $this->insurance((string) $rule['kind'], (int) $rule['amount']),
            'certification' => $this->certification((string) $rule['name']),
            'years_trading' => $this->yearsTrading((int) $rule['years']),
            'vault_documents' => $this->vaultDocuments((string) $rule['category'], (int) ($rule['count'] ?? 1)),
            default => new Outcome(
                S::Unknown,
                'Needs your judgement',
                'There is no automatic rule for this requirement. Read it and set the status yourself.',
                method: 'user',
                fix: ['remedy' => 'Decide whether you meet it and set the status in the eligibility check.', 'days' => 1],
            ),
        };
    }

    private function turnover(int $amount, int $years): Outcome
    {
        $rows = collect($this->profile->turnover ?? [])
            ->sortByDesc(fn ($r) => (int) preg_replace('/\D/', '', $r['year']))
            ->values();
        $need = self::gbp($amount).($years > 1 ? " in each of the last {$years} years" : '');

        if ($rows->isEmpty()) {
            return new Outcome(S::Unknown, 'No turnover in your company profile', "The buyer asks for turnover of {$need}. Your company profile has no turnover, so this can’t be checked.",
                fix: ['remedy' => 'Add your turnover for recent years to the company profile.', 'days' => 1]);
        }

        $recent = $rows->take($years);
        $facts = $recent->map(fn ($r) => $this->fact('turnover-'.$r['year'], "Turnover {$r['year']}", self::gbp((int) $r['amount']), 'financial_statement', $this->firstDoc('financial')))->all();
        $list = $recent->map(fn ($r) => "{$r['year']}: ".self::gbp((int) $r['amount']))->implode(', ');
        $below = $recent->filter(fn ($r) => (int) $r['amount'] < $amount);

        if ($below->isNotEmpty()) {
            return new Outcome(S::NotMet, 'Turnover is below '.self::gbp($amount), "The buyer asks for turnover of {$need}. Your profile shows {$list}.", facts: $facts,
                fix: ['remedy' => 'Bid with a partner or as a subcontractor, or ask the buyer whether a parent company guarantee is accepted.', 'days' => 15]);
        }

        if ($recent->count() < $years) {
            return new Outcome(S::PartiallyMet, "Only {$recent->count()} of {$years} years recorded", "The buyer asks for turnover of {$need}. Your profile shows {$list}, which meets it, but not for every year asked for.", facts: $facts,
                fix: ['remedy' => 'Add the missing years of turnover to the company profile.', 'days' => 1]);
        }

        return new Outcome(S::Met, 'Turnover meets the minimum', "The buyer asks for turnover of {$need}. Your profile shows {$list}.", facts: $facts);
    }

    private function insurance(string $kind, int $amount): Outcome
    {
        $label = ['public' => 'Public liability', 'employers' => 'Employer’s liability', 'professional' => 'Professional indemnity'][$kind] ?? 'Insurance';
        $pattern = ['public' => '/public/i', 'employers' => '/employer/i', 'professional' => '/professional|indemnity/i'][$kind] ?? '/$^/';
        $row = collect($this->profile->insurance ?? [])->first(fn ($r) => preg_match($pattern, $r['label']));
        $doc = $this->vault->first(fn (VaultDocument $d) => $d->category->value === 'insurance' && preg_match($pattern, $d->title));

        if ($row === null) {
            return new Outcome(S::Unknown, "No {$label} cover in your profile", "The buyer asks for {$label} cover of at least ".self::gbp($amount).'. Your company profile does not list it.',
                facts: $doc ? [$this->docFact($doc)] : [],
                fix: ['remedy' => "Add your {$label} cover to the company profile and upload the certificate.", 'days' => 1, 'evidence' => ['scope' => 'company', 'title' => "{$label} insurance", 'category' => 'insurance']]);
        }

        $cover = (int) $row['cover'];
        $facts = [$this->fact("insurance-{$kind}", "{$label} cover", self::gbp($cover), 'company_profile', $doc)];
        $need = "{$label} cover of at least ".self::gbp($amount);

        if ($cover < $amount) {
            return new Outcome(S::NotMet, "{$label} cover is too low", "The buyer asks for {$need}. You have ".self::gbp($cover).'.', facts: $facts,
                fix: ['remedy' => "Ask your insurer to raise {$label} cover to ".self::gbp($amount).', and upload the new certificate.', 'days' => 5, 'evidence' => ['scope' => 'company', 'title' => "{$label} insurance", 'category' => 'insurance']]);
        }

        if ($doc === null) {
            return new Outcome(S::PartiallyMet, 'Cover is enough, but no certificate', "The buyer asks for {$need}. Your profile says ".self::gbp($cover).', but there is no certificate in your vault to prove it.', facts: $facts,
                fix: ['remedy' => "Upload your {$label} certificate to the vault.", 'days' => 1, 'evidence' => ['scope' => 'company', 'title' => "{$label} insurance", 'category' => 'insurance']]);
        }

        return $this->withExpiry($doc, new Outcome(S::Met, "{$label} cover is enough", "The buyer asks for {$need}. You have ".self::gbp($cover).", backed by “{$doc->title}”.", facts: $facts));
    }

    private function certification(string $name): Outcome
    {
        $key = self::normalise($name);
        $doc = $this->vault->first(fn (VaultDocument $d) => str_contains(self::normalise($d->title), $key)
            || $d->facts->contains(fn ($f) => str_contains(self::normalise((string) $f->label), $key)));

        if ($doc === null) {
            $iso = str_starts_with($key, 'iso');

            return new Outcome(S::Unknown, "{$name} is not in your vault", "The buyer asks for {$name}. There is no {$name} certificate in your vault, so this can’t be confirmed.",
                fix: [
                    'remedy' => "Upload your {$name} certificate if you have one. If not, getting certified usually takes ".($iso ? 'two to three months' : 'two to four weeks').'.',
                    'days' => $iso ? 60 : 15,
                    'evidence' => ['scope' => 'company', 'title' => $name, 'category' => 'certificate'],
                ]);
        }

        return $this->withExpiry($doc, new Outcome(S::Met, "{$name} held", "The buyer asks for {$name}. Your vault has “{$doc->title}”.", facts: [$this->docFact($doc)]));
    }

    private function yearsTrading(int $years): Outcome
    {
        $since = $this->profile?->incorporated_at;
        if ($since === null) {
            return new Outcome(S::Unknown, 'No incorporation date in your profile', "The buyer asks for at least {$years} years of trading. Your company profile has no incorporation date.",
                fix: ['remedy' => 'Add your incorporation date to the company profile.', 'days' => 1]);
        }

        $have = (int) floor($since->diffInYears($this->deadline));
        $facts = [$this->fact('incorporated', 'Incorporated', $since->format('j M Y'), 'company_profile', $this->firstDoc('company'))];
        $why = "The buyer asks for at least {$years} years of trading. You were incorporated on {$since->format('j M Y')}, {$have} years before the deadline.";
        $ch = $this->profile->companies_house ?? null;
        if ($ch !== null && $ch['found']) {
            $why .= ($ch['dateMatches'] ?? false)
                ? ' Confirmed with Companies House.'
                : ' Companies House has a different date ('.($ch['incorporatedOn'] ?? 'none').'); check your profile.';
        }

        return $have >= $years
            ? new Outcome(S::Met, "Trading for {$have} years", $why, facts: $facts)
            : new Outcome(S::NotMet, "Trading for {$have} of {$years} years", $why, facts: $facts,
                fix: ['remedy' => 'Ask the buyer whether a parent company’s history counts, or bid as a subcontractor.', 'days' => 10]);
    }

    private function vaultDocuments(string $category, int $count): Outcome
    {
        $docs = $this->vault->filter(fn (VaultDocument $d) => $d->category->value === $category)->values();
        $noun = VaultCategory::from($category)->noun();
        $have = $docs->count();
        $missing = max(1, $count - $have);
        $facts = $docs->take(5)->map(fn (VaultDocument $d) => $this->docFact($d))->all();
        $why = "The buyer asks for {$count} ".Str::plural($noun, $count).". Your vault has {$have}.";
        $fix = ['remedy' => "Add {$missing} more ".Str::plural($noun, $missing).' to the vault.', 'days' => 3,
            'evidence' => ['scope' => 'company', 'title' => Str::ucfirst($noun), 'category' => $category]];

        return match (true) {
            $have >= $count => new Outcome(S::Met, "{$have} in the vault", $why, facts: $facts),
            $have === 0 => new Outcome(S::Unknown, 'None in the vault yet', $why, fix: $fix),
            default => new Outcome(S::PartiallyMet, "{$have} of {$count} in the vault", $why, facts: $facts, fix: $fix),
        };
    }

    /** EVD-02: a document that runs out before the deadline only partly meets it. */
    private function withExpiry(VaultDocument $doc, Outcome $met): Outcome
    {
        // The content check's warnings stay visible in the evidence (they don't change the status).
        $warnings = collect($doc->check_notes ?? [])->where('level', 'warn')->pluck('text');
        if ($warnings->isNotEmpty()) {
            $met = new Outcome($met->status, $met->summary,
                $met->reasoning." ProcurPilot’s check of this document found: {$warnings->implode(' ')}",
                $met->method, $met->facts, $met->stale, $met->fix);
        }

        if ($doc->expires_at === null || $doc->expires_at->gte($this->deadline->copy()->startOfDay())) {
            return $met;
        }

        $expired = $doc->expires_at->isPast();

        return new Outcome(
            S::PartiallyMet,
            $expired ? "“{$doc->title}” has expired" : "“{$doc->title}” expires before the deadline",
            $met->reasoning.' It '.($expired ? 'expired' : 'expires').' on '.$doc->expires_at->format('j M Y').', before the deadline of '.$this->deadline->format('j M Y').'.',
            facts: $met->facts,
            stale: ['factLabel' => $doc->title, 'expiresAt' => $doc->expires_at->toDateString()],
            fix: ['remedy' => "Renew “{$doc->title}” and upload the new version before the deadline.", 'days' => 10,
                'evidence' => ['scope' => 'company', 'title' => $doc->title, 'category' => $doc->category->value]],
        );
    }

    private function firstDoc(string $category): ?VaultDocument
    {
        return $this->vault->first(fn (VaultDocument $d) => $d->category->value === $category);
    }

    /**
     * @return array<string, mixed>
     */
    private function docFact(VaultDocument $doc): array
    {
        return $this->fact("doc-{$doc->id}", $doc->title, $doc->reference ?? $doc->title, $doc->category->factSource()->value, $doc);
    }

    /**
     * Shape of `ProfileFact` in resources/js/types/ebis.ts.
     *
     * @return array<string, mixed>
     */
    private function fact(string $id, string $label, string $value, string $source, ?VaultDocument $doc): array
    {
        return array_filter([
            'id' => $id,
            'label' => $label,
            'value' => $value,
            'source' => $source,
            'documentName' => $doc?->file_name,
            'verifiedAt' => $doc?->created_at->toDateString(),
            'expiresAt' => $doc?->expires_at?->toDateString(),
        ], fn ($v) => $v !== null);
    }

    private static function gbp(int $amount): string
    {
        return '£'.number_format($amount);
    }

    /** "ISO/IEC 27001" and "ISO 27001" both become "iso27001". */
    private static function normalise(string $s): string
    {
        return (string) preg_replace('/[^a-z0-9]/', '', str_replace('/iec', '', strtolower($s)));
    }
}
