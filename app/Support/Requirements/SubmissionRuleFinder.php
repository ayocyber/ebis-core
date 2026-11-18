<?php

namespace App\Support\Requirements;

/**
 * TUN-04 without AI: the submission rules a tender pack states in plain words
 * (where to submit, file types and sizes, page and word limits, font, file
 * naming), found by pattern. The readiness check tests the bid against them.
 *
 * Each rule keeps the sentence it came from, so the user can see why it is there.
 * Rules the pack does not state are not invented.
 */
class SubmissionRuleFinder
{
    private const PORTAL = '/\b(e-?tender(?:ing)?\s+(?:portal|system)|procurement\s+portal|(?:the|our)\s+portal|ProContract|In-?Tend|Delta\s+eSourcing|Atamis|Jaggaer|Bravo\s*Solution|Proactis|Mercell|Coupa|SAP\s+Ariba|Sell2Wales|Public\s+Contracts\s+Scotland)\b/i';

    private const SUBMIT = '/\b(submi\w+|upload\w*|return\w*|respon\w+|tender\w*)\b/i';

    private const SIZE = '/(?:not\s+exceed|maximum(?:\s+file)?\s+size(?:\s+(?:of|is|allowed\s+is))?|max(?:imum)?\.?\s+of|no\s+(?:larger|bigger|more)\s+than|up\s+to|limit(?:ed)?\s+(?:of|to))\s*(\d{1,4}(?:\.\d+)?)\s*(MB|megabytes?|GB|gigabytes?)\b|(\d{1,4}(?:\.\d+)?)\s*(MB|GB)\s+(?:max(?:imum)?|limit)/i';

    private const LIMIT = '/(?:max(?:imum)?\.?(?:\s+(?:of|length))?|no\s+more\s+than|not\s+(?:to\s+)?exceed(?:ing)?|limited\s+to|up\s+to|limit\s+of|must\s+not\s+be\s+(?:more|longer)\s+than)\s*:?\s*(\d{1,3}(?:,\d{3})?|\d{1,5})\s*(pages?|sides?(?:\s+of\s+A4)?|words?)\b|\b(\d{1,3}(?:,\d{3})?|\d{1,5})\s*(pages?|sides?(?:\s+of\s+A4)?|words?)\s*(?:max(?:imum)?|limit)\b|\b(word|page)\s+(?:limit|count)\s*(?:of|is|:)?\s*(\d{1,3}(?:,\d{3})?|\d{1,5})\b/i';

    private const FONT = '/\b(Arial|Calibri|Verdana|Helvetica|Times\s+New\s+Roman|Tahoma)\b[^.]{0,40}?\b(\d{1,2})\s*(?:pt|point)\b|\bfont(?:\s+size)?\s+(?:of\s+|no\s+smaller\s+than\s+|at\s+least\s+|minimum\s+(?:of\s+)?)?(\d{1,2})\s*(?:pt|point)?\b/i';

    private const FORMAT = '/\b(PDF|Adobe|Microsoft\s+Word|Word\s+format|\.docx?|Excel|\.xlsx?|\.pdf|open\s+document)\b/i';

    private const NAMING = '/\b(file\s*names?|naming\s+convention|(?:should|must)\s+be\s+(?:re)?named|label(?:led)?\s+(?:each|all)\s+files?)\b/i';

    /**
     * @param  list<array{name: string, text: string}>  $documents
     * @return list<array{id: string, label: string, value: string, source: string, limit?: float, limits?: list<array{about: string, unit: string, max: int}>}>
     */
    public function find(array $documents): array
    {
        $rules = [];
        $limits = [];
        $limitSources = [];

        foreach ($documents as $doc) {
            foreach (explode("\f", $doc['text']) as $p => $page) {
                $source = $doc['name'].' p.'.($p + 1);
                foreach (self::sentences($page) as $s) {
                    if (! isset($rules['r-portal']) && preg_match(self::PORTAL, $s) && preg_match(self::SUBMIT, $s)) {
                        $rules['r-portal'] = ['id' => 'r-portal', 'label' => 'Where', 'value' => self::short($s), 'source' => $source];
                    }
                    if (! isset($rules['r-size']) && preg_match(self::SIZE, $s, $m)) {
                        $amount = (float) ($m[1] !== '' ? $m[1] : $m[3]);
                        $unit = strtoupper(substr($m[1] !== '' ? $m[2] : $m[4], 0, 1));
                        $mb = $unit === 'G' ? $amount * 1024 : $amount;
                        $rules['r-size'] = ['id' => 'r-size', 'label' => 'File size', 'value' => 'Up to '.self::number($mb).' MB per file', 'source' => $source, 'limit' => $mb];
                    }
                    if (preg_match_all(self::LIMIT, $s, $all, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
                        foreach ($all as $m) {
                            [$max, $unit] = isset($m[5]) && $m[5][0] !== ''
                                ? [$m[6][0], $m[5][0]]
                                : ($m[1][0] !== '' ? [$m[1][0], $m[2][0]] : [$m[3][0], $m[4][0]]);
                            $max = (int) str_replace(',', '', $max);
                            $unit = str_starts_with(strtolower($unit), 'word') ? 'words' : 'pages';
                            if ($max < 1 || ($unit === 'pages' && $max > 200) || ($unit === 'words' && $max < 20)) {
                                continue;
                            }
                            $about = self::about(substr($s, 0, $m[0][1]));
                            $key = "{$about}|{$unit}";
                            if (! isset($limits[$key])) {
                                $limits[$key] = ['about' => $about, 'unit' => $unit, 'max' => $max];
                                $limitSources[] = $source;
                            }
                        }
                    }
                    if (! isset($rules['r-font']) && preg_match(self::FONT, $s, $m)) {
                        $size = (int) $m[2] ?: (int) ($m[3] ?? 0);
                        if ($size >= 8 && $size <= 16) {
                            $face = $m[1] !== '' ? preg_replace('/\s+/', ' ', $m[1]).' ' : '';
                            $rules['r-font'] = ['id' => 'r-font', 'label' => 'Formatting', 'value' => "{$face}{$size}pt minimum", 'source' => $source];
                        }
                    }
                    if (! isset($rules['r-format']) && preg_match(self::FORMAT, $s) && preg_match('/\b(format|file\s+types?|submitted\s+(?:in|as)|must\s+be\s+(?:in|a)|provided\s+(?:in|as)|saved\s+as)\b/i', $s)) {
                        $rules['r-format'] = ['id' => 'r-format', 'label' => 'File types', 'value' => self::short($s), 'source' => $source];
                    }
                    if (! isset($rules['r-naming']) && preg_match(self::NAMING, $s)) {
                        $rules['r-naming'] = ['id' => 'r-naming', 'label' => 'File naming', 'value' => self::short($s), 'source' => $source];
                    }
                }
            }
        }

        if ($limits !== []) {
            $text = implode('. ', array_map(
                fn ($l) => ($l['about'] !== '' ? ucfirst($l['about']) : 'Whole response').': '.number_format($l['max']).' '.$l['unit'],
                array_values($limits),
            ));
            $rules['r-pages'] = [
                'id' => 'r-pages', 'label' => 'Page and word limits', 'value' => $text.'.',
                'source' => implode(', ', array_unique($limitSources)), 'limits' => array_values($limits),
            ];
        }

        // Shown in this order on the readiness screen.
        $order = ['r-portal', 'r-format', 'r-size', 'r-pages', 'r-font', 'r-naming'];

        return array_values(array_filter(array_map(fn ($id) => $rules[$id] ?? null, $order)));
    }

    /** @return list<string> */
    private static function sentences(string $page): array
    {
        $text = (string) preg_replace('/[ \t]+/', ' ', $page);
        $parts = preg_split('/(?<=[.!?;])\s+(?=[A-Z0-9(])|\R{2,}|\R(?=\s*(?:\d+(?:\.\d+)*[.)]?|[•\-–])\s)/u', $text) ?: [];

        return array_values(array_filter(array_map(fn ($s) => trim((string) preg_replace('/\s+/', ' ', $s)), $parts), fn ($s) => strlen($s) > 8));
    }

    /**
     * What a limit is about, from the words just before it: "Question 3 – Technical
     * approach (maximum 15 pages)" gives "technical approach". Empty for the whole response.
     */
    private static function about(string $before): string
    {
        $before = (string) preg_replace('/[(\[:–—-]\s*$/u', '', trim($before));
        // The last clause before the limit; generic words tell us nothing.
        $parts = preg_split('/[,;:()\[\]–—]|\s-\s/u', $before) ?: [''];
        $clause = trim((string) end($parts));
        $clause = (string) preg_replace('/^(?:Q(?:uestion)?\s*\d+[.)]?|\d+(?:\.\d+)*[.)]?)\s*/i', '', $clause);
        $clause = (string) preg_replace('/\b(the|your|each|every|all|a|an|response|responses|answer|answers|submission|should|must|be|is|are|will|shall|to|of|for|in|with|tenderers?|bidders?|suppliers?|has|have|a\s+maximum|maximum|max|limit(?:ed)?|length|no|more|than|not|exceed(?:ing)?|up|please|keep|ensure|that|this|section|question|written)\b/i', ' ', $clause);
        $clause = trim((string) preg_replace('/\s+/', ' ', $clause));
        $words = array_slice(explode(' ', $clause), -4);
        $about = strtolower(trim(implode(' ', array_filter($words, fn ($w) => strlen($w) > 2))));

        // "The whole response", "overall", "in total": the limit is for everything.
        return preg_match('/^(?:whole|overall|total|entire|combined|altogether)?$/', $about) ? '' : $about;
    }

    private static function short(string $s): string
    {
        return mb_strlen($s) > 220 ? rtrim(mb_substr($s, 0, 217)).'…' : $s;
    }

    private static function number(float $n): string
    {
        return rtrim(rtrim(number_format($n, 1), '0'), '.');
    }
}
