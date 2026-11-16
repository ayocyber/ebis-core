<?php

namespace App\Support\Vault;

use App\Support\Tenders\TextExtractor;

/**
 * Reads an uploaded file before it is saved, so the upload form can be filled in from
 * what the document actually says: its type, who issued it, its reference, its expiry
 * date and (for insurance) the cover. Pattern-based, no AI. Anything not found stays
 * empty for the user to type; nothing is invented.
 */
class DocumentReader
{
    /**
     * Document types, most specific first: [slot id, any of these in the text].
     * Slot ids match resources/js/data/evidence-slots.ts.
     *
     * @var list<array{0: string, 1: string}>
     */
    private const KINDS = [
        ['cep', '/cyber essentials/i'],
        ['incorp', '/certificate of incorporation|registrar of companies/i'],
        ['el', '/employer\W{0,3}s?\W{0,3}liability/i'],
        ['pl', '/public (?:and products )?liability/i'],
        ['pi', '/professional indemnity/i'],
        ['iso', '/\bISO\W*(?:IEC\W*)?(?:9001|14001|27001|45001)\b/i'],
        ['accounts', '/balance sheet|profit and loss|statement of financial position|financial statements|annual report and accounts/i'],
        ['cv', '/curriculum vitae|\bCV\b|\bresume\b/i'],
        ['case', '/case study|reference:|contract (?:value|delivered)/i'],
        ['crp', '/carbon reduction plan|net zero/i'],
        ['sv', '/social value/i'],
        ['hs', '/health and safety policy|health & safety policy/i'],
    ];

    private const ISSUER = '/(?:insurer|underwritten by|certification body|certifying body|issued by|registrar)\s*:\s*([^.\n]{3,80}?(?:\b(?:plc|ltd|limited|llp)\b\.?)?)(?=\.\s|\n|$|\s+(?:policy|certificate|date|expiry)\b)/i';

    // Not "company registration number": that is the company number, not the document's.
    private const REFERENCE = '/(?:policy|certificate|(?<!company )registration|cert\.?)\s*(?:number|no\.?|ref(?:erence)?)\s*:?\s*([A-Z0-9][A-Z0-9\/\-]{3,40})/i';

    public function __construct(private TextExtractor $extractor) {}

    /**
     * @return array{readable: bool, kind: string|null, issuer: string|null, reference: string|null, expires_at: string|null, fact: string|null}
     */
    public function read(string $localPath, string $extension): array
    {
        $empty = ['readable' => false, 'kind' => null, 'issuer' => null, 'reference' => null, 'expires_at' => null, 'fact' => null];
        if (! in_array($extension, ['pdf', 'docx'], true)) {
            return $empty;
        }

        $text = (string) preg_replace('/[ \t]+/u', ' ', (string) $this->extractor->extract($localPath, $extension)->text);
        if (mb_strlen(trim($text)) < 20) {
            return $empty;
        }

        $kind = null;
        foreach (self::KINDS as [$id, $pattern]) {
            if (preg_match($pattern, $text)) {
                $kind = $id;
                break;
            }
        }

        return [
            'readable' => true,
            'kind' => $kind,
            'issuer' => preg_match(self::ISSUER, $text, $m) ? rtrim(trim($m[1]), '.') : null,
            'reference' => preg_match(self::REFERENCE, $text, $m) ? rtrim($m[1], '.-/') : null,
            'expires_at' => DocumentChecker::expiryInText((string) preg_replace('/\s+/u', ' ', $text))?->toDateString(),
            'fact' => in_array($kind, ['el', 'pl', 'pi'], true) ? self::cover($text) : null,
        ];
    }

    /** "Limit of indemnity: GBP 10,000,000 any one occurrence" → "Cover: £10,000,000 any one occurrence" */
    private static function cover(string $text): ?string
    {
        if (! preg_match('/(?:limit of indemnity|indemnity limit|limit|cover)[^£\d]{0,30}(?:£|GBP\s?)\s?([\d,]+(?:\.\d+)?\s?(?:m(?:illion)?\b)?)([^.\n]{0,30}?(?:any one (?:occurrence|claim)|in the aggregate))?/i', $text, $m)) {
            return null;
        }

        return 'Cover: £'.trim($m[1]).(isset($m[2]) && trim($m[2]) !== '' ? ' '.trim($m[2]) : '');
    }
}
