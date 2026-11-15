<?php

namespace App\Support\Vault;

use App\Models\CompanyProfile;
use App\Models\VaultDocument;
use App\Support\Tenders\TextExtractor;
use Carbon\Carbon;
use Illuminate\Support\Str;

/**
 * Checks that a vault document's text matches what it claims to be, without AI:
 * the right kind of document, the company's name and number, the expiry date the
 * user typed, and the insurance cover in the profile.
 *
 * Findings are warnings, never blocks. Scans and photos have no text, so they are
 * reported as not checkable rather than passed.
 */
class DocumentChecker
{
    /**
     * What each kind of document should mention: [title pattern, what it is, any of these in the text].
     *
     * @var list<array{0: string, 1: string, 2: list<string>}>
     */
    private const KINDS = [
        ['/incorporat/i', 'a certificate of incorporation', ['/certificate of incorporation/i', '/companies house/i', '/registrar of companies/i']],
        ['/employer/i', 'an employer’s liability certificate', ['/employer\W{0,3}s?\W{0,3}liability/i']],
        ['/public liability/i', 'a public liability certificate', ['/public (and products )?liability/i']],
        ['/professional indemnity|\bPI\b/i', 'a professional indemnity certificate', ['/professional indemnity/i']],
        ['/cyber essentials/i', 'a Cyber Essentials certificate', ['/cyber essentials/i']],
        ['/\bISO\W*(?:IEC\W*)?\d{4,5}/i', 'an ISO certificate', []], // the standard's number is checked below
        ['/accounts|financial statement|annual report/i', 'a set of accounts', ['/balance sheet/i', '/profit and loss/i', '/statement of financial position/i', '/income statement/i', '/turnover/i']],
        ['/confirmation statement/i', 'a confirmation statement', ['/confirmation statement/i']],
    ];

    private const EXPIRY_WORDS = '(?:valid until|valid to|expiry date|date of expiry|expires(?: on)?|expiry|renewal date|period of insurance[^.]{0,40}?to|until)';

    public function __construct(private TextExtractor $extractor) {}

    public function check(VaultDocument $doc, string $localPath, ?CompanyProfile $profile): CheckResult
    {
        $extension = strtolower(pathinfo($doc->file_name, PATHINFO_EXTENSION));
        if (! in_array($extension, ['pdf', 'docx'], true)) {
            return CheckResult::unreadable('This is an image, so its text can’t be checked. Check it yourself.');
        }

        $read = $this->extractor->extract($localPath, $extension);
        $text = (string) preg_replace('/\s+/u', ' ', (string) $read->text);
        if (mb_strlen(trim($text)) < 20) {
            return CheckResult::unreadable('No text could be read (it looks like a scan or a photo). Check it yourself.');
        }

        $notes = [];
        $this->kind($doc, $text, $notes);
        $this->company($doc, $text, $profile, $notes);
        $this->expiry($doc, $text, $notes);
        $this->cover($doc, $text, $profile, $notes);

        return new CheckResult($notes);
    }

    /**
     * @param  list<array{level: string, text: string}>  $notes
     */
    private function kind(VaultDocument $doc, string $text, array &$notes): void
    {
        foreach (self::KINDS as [$title, $what, $expected]) {
            if (! preg_match($title, $doc->title)) {
                continue;
            }

            if (preg_match('/\bISO\W*(?:IEC\W*)?(\d{4,5})/i', $doc->title, $m)) {
                $expected = ['/\bISO\W*(?:IEC\W*)?'.$m[1].'\b/i'];
                $what = "an ISO {$m[1]} certificate";
            }
            if (preg_match('/cyber essentials\W*(plus|\+)/i', $doc->title)) {
                $expected = ['/cyber essentials\W*(plus|\+)/i'];
                $what = 'a Cyber Essentials Plus certificate';
            }

            $found = collect($expected)->first(fn (string $p) => preg_match($p, $text));
            $notes[] = $found !== null
                ? ['level' => 'ok', 'text' => "Looks like {$what}."]
                : ['level' => 'warn', 'text' => "Doesn’t look like {$what}: none of the usual wording was found. Is it the right file?"];

            return;
        }
    }

    /**
     * @param  list<array{level: string, text: string}>  $notes
     */
    private function company(VaultDocument $doc, string $text, ?CompanyProfile $profile, array &$notes): void
    {
        if ($profile === null) {
            return;
        }

        $names = array_filter([self::coreName($profile->legal_name), self::coreName($profile->trading_name)]);
        if ($names !== []) {
            $plain = self::plain($text);
            $notes[] = collect($names)->contains(fn (string $n) => str_contains($plain, $n))
                ? ['level' => 'ok', 'text' => 'Your company name appears in it.']
                : ['level' => 'warn', 'text' => "Your company name ({$profile->legal_name}) isn’t in it. Is it another company’s document?"];
        }

        // Company documents should carry the company number.
        if ($profile->company_number && preg_match('/incorporat|confirmation statement|accounts/i', $doc->title)) {
            $number = ltrim((string) preg_replace('/\s+/', '', $profile->company_number), '0');
            $notes[] = $number !== '' && preg_match('/\b0*'.preg_quote($number, '/').'\b/', (string) preg_replace('/(?<=\d)\s+(?=\d)/', '', $text))
                ? ['level' => 'ok', 'text' => "Your company number ({$profile->company_number}) appears in it."]
                : ['level' => 'warn', 'text' => "Your company number ({$profile->company_number}) isn’t in it."];
        }
    }

    /**
     * @param  list<array{level: string, text: string}>  $notes
     */
    private function expiry(VaultDocument $doc, string $text, array &$notes): void
    {
        if ($doc->expires_at !== null) {
            $notes[] = self::mentionsDate($text, $doc->expires_at)
                ? ['level' => 'ok', 'text' => 'The expiry date you entered ('.$doc->expires_at->format('j M Y').') is in the document.']
                : ['level' => 'warn', 'text' => 'The expiry date you entered ('.$doc->expires_at->format('j M Y').') isn’t in the document. Check it.'];

            return;
        }

        $found = self::expiryInText($text);
        if ($found !== null) {
            $notes[] = ['level' => 'warn', 'text' => 'The document seems to expire on '.$found->format('j M Y').'. Add the expiry date so you are reminded to renew it.'];
        }
    }

    /**
     * The insurance cover recorded in the profile should be on the certificate.
     *
     * @param  list<array{level: string, text: string}>  $notes
     */
    private function cover(VaultDocument $doc, string $text, ?CompanyProfile $profile, array &$notes): void
    {
        if ($profile === null || $doc->category->value !== 'insurance') {
            return;
        }

        $kind = match (true) {
            (bool) preg_match('/employer/i', $doc->title) => '/employer/i',
            (bool) preg_match('/public/i', $doc->title) => '/public/i',
            (bool) preg_match('/professional|indemnity/i', $doc->title) => '/professional|indemnity/i',
            default => null,
        };
        $row = $kind ? collect($profile->insurance ?? [])->first(fn ($r) => preg_match($kind, $r['label'])) : null;
        if ($row === null) {
            return;
        }

        $cover = (int) $row['cover'];
        $millions = $cover / 1_000_000;
        $forms = array_filter([
            number_format($cover),
            (string) $cover,
            floor($millions) == $millions ? "{$millions}m" : null,
            floor($millions) == $millions ? "{$millions} million" : null,
            floor($millions) == $millions ? "{$millions},000,000" : null,
        ]);
        $plain = strtolower((string) preg_replace('/\s+/', ' ', $text));
        $found = collect($forms)->contains(fn (string $f) => str_contains($plain, strtolower($f)));

        $notes[] = $found
            ? ['level' => 'ok', 'text' => 'The cover in your profile (£'.number_format($cover).') appears in it.']
            : ['level' => 'warn', 'text' => 'The cover in your profile (£'.number_format($cover).') isn’t in it. Check the amount.'];
    }

    private static function mentionsDate(string $text, Carbon $date): bool
    {
        $formats = ['j F Y', 'jS F Y', 'j M Y', 'jS M Y', 'd F Y', 'd M Y', 'd/m/Y', 'j/n/Y', 'd.m.Y', 'd-m-Y', 'Y-m-d', 'd/m/y', 'F j, Y', 'M j, Y'];
        $plain = strtolower($text);

        return collect($formats)->contains(fn (string $f) => str_contains($plain, strtolower($date->format($f))));
    }

    private static function expiryInText(string $text): ?Carbon
    {
        $date = '(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}-\d{2}-\d{2})';
        if (! preg_match('/'.self::EXPIRY_WORDS.'\s*:?\s*'.$date.'/i', $text, $m)) {
            return null;
        }

        try {
            $raw = (string) preg_replace('/(\d)(st|nd|rd|th)/i', '$1', $m[1]);

            return preg_match('/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}$/', $raw)
                ? Carbon::createFromFormat('d/m/Y', (string) preg_replace('/[.\-]/', '/', $raw))->startOfDay()
                : Carbon::parse($raw)->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }

    /** "Bluewave Networks Ltd." → "bluewave networks" */
    private static function coreName(?string $name): ?string
    {
        if ($name === null || trim($name) === '') {
            return null;
        }
        $core = trim((string) preg_replace('/\b(ltd|limited|plc|llp|lp|inc|uk)\b/', '', self::plain($name)));

        return mb_strlen($core) >= 3 ? $core : null;
    }

    private static function plain(string $s): string
    {
        return trim((string) preg_replace('/\s+/', ' ', (string) preg_replace('/[^a-z0-9]+/', ' ', Str::lower(Str::ascii($s)))));
    }
}
