/**
 * Validation checks that read across the whole bid:
 * VAL-05  contradictions between sections (different figures, names or dates)
 * VAL-03  page / word limits, file formats, file size and naming against the tender rules
 */
import type { SubmissionRule } from '@/data/mock-requirements';
import type { ResolvedItem } from '@/lib/checklist';
import type { BidSection } from '@/types/ebis';

/* VAL-05 ----------------------------------------------------------- */

export interface Mention {
    sectionId: string;
    sectionTitle: string;
    value: string;
    excerpt: string;
}

export interface Contradiction {
    id: string;
    topic: string;
    a: Mention;
    b: Mention;
}

/** What to compare, and how to pull the value out of a sentence. */
const facts: { topic: string; pattern: RegExp; value: (m: RegExpExecArray) => string }[] = [
    {
        topic: 'Number of engineers',
        pattern: /(\d[\d,]*)\s+(?:[a-z-]+\s+){0,2}engineers\b/gi,
        value: (m) => m[1].replace(/,/g, ''),
    },
    {
        topic: 'Number of staff',
        pattern: /(\d[\d,]*)\s+(?:[a-z-]+\s+){0,2}(?:staff|employees|people)\b/gi,
        value: (m) => m[1].replace(/,/g, ''),
    },
    {
        topic: 'Year the company started',
        pattern: /(?:founded|established|incorporated|trading|registered[\s\S]{0,60}?since)\s+(?:in\s+)?(?:[A-Z][a-z]+\s+)?((?:19|20)\d{2})/g,
        value: (m) => m[1],
    },
    {
        topic: 'Company number',
        pattern: /company (?:no\.|number)\s*(\d{8})/gi,
        value: (m) => m[1],
    },
];

export function findContradictions(sections: BidSection[]): Contradiction[] {
    const out: Contradiction[] = [];
    for (const f of facts) {
        const mentions: Mention[] = [];
        for (const s of sections) {
            const re = new RegExp(f.pattern.source, f.pattern.flags);
            let m: RegExpExecArray | null;
            while ((m = re.exec(s.body))) {
                mentions.push({ sectionId: s.id, sectionTitle: s.title, value: f.value(m), excerpt: m[0].trim() });
            }
        }
        // Report the first disagreement per pair of values, so one typo isn't listed ten times.
        const seen = new Set<string>();
        for (let i = 0; i < mentions.length; i++) {
            for (let j = i + 1; j < mentions.length; j++) {
                const a = mentions[i];
                const b = mentions[j];
                const key = [a.value, b.value].sort().join('|');
                if (a.value === b.value || seen.has(key)) continue;
                seen.add(key);
                out.push({ id: `c-${f.topic}-${key}`, topic: f.topic, a, b });
            }
        }
    }
    return out;
}

/* VAL-03 ----------------------------------------------------------- */

export interface RuleBreach {
    where: string;
    message: string;
    fix: 'bid' | 'documents';
}

export interface RuleCheck {
    rule: SubmissionRule;
    breaches: RuleBreach[];
    /** Shown when there's nothing to fix */
    note: string;
}

const MAX_FILE_MB = 20;
/** A dense A4 page of 11pt Arial runs to roughly 500 words. */
const WORDS_PER_PAGE = 500;
const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Page limits the tender sets, matched to bid sections by title. */
const pageLimits: { match: RegExp; pages: number }[] = [
    { match: /technical approach/i, pages: 15 },
    { match: /case stud|experience/i, pages: 4 },
];

export function checkRules(rules: SubmissionRule[], sections: BidSection[], documents: ResolvedItem[]): RuleCheck[] {
    const uploaded = documents.filter((d) => d.progress.fileName && d.status !== 'not_applicable');

    return rules.map((rule) => {
        const breaches: RuleBreach[] = [];
        let note = 'Nothing to check yet';

        switch (rule.id) {
            case 'r-format': {
                for (const d of uploaded) {
                    const ext = d.progress.fileName!.split('.').pop()!.toLowerCase();
                    if (!d.item.formats.includes(ext))
                        breaches.push({
                            where: d.progress.fileName!,
                            message: `${d.item.title} must be ${d.item.formats.map((f) => `.${f}`).join(' or ')}, not .${ext}.`,
                            fix: 'documents',
                        });
                }
                note = `${uploaded.length} uploaded file${uploaded.length === 1 ? '' : 's'} in the right format`;
                break;
            }
            case 'r-size': {
                for (const d of uploaded) {
                    const mb = (d.progress.sizeBytes ?? 0) / 1024 ** 2;
                    if (mb > MAX_FILE_MB)
                        breaches.push({
                            where: d.progress.fileName!,
                            message: `${mb.toFixed(1)} MB is over the ${MAX_FILE_MB} MB limit. Compress it or split it.`,
                            fix: 'documents',
                        });
                }
                note = `Every file is under ${MAX_FILE_MB} MB`;
                break;
            }
            case 'r-pages': {
                for (const s of sections) {
                    const limit = pageLimits.find((p) => p.match.test(s.title));
                    const pages = Math.ceil(words(s.body) / WORDS_PER_PAGE);
                    if (limit && pages > limit.pages)
                        breaches.push({
                            where: s.title,
                            message: `About ${pages} pages, over the ${limit.pages}-page limit.`,
                            fix: 'bid',
                        });
                    if (s.wordLimit && words(s.body) > s.wordLimit)
                        breaches.push({
                            where: s.title,
                            message: `${words(s.body).toLocaleString()} words, over the ${s.wordLimit.toLocaleString()}-word limit.`,
                            fix: 'bid',
                        });
                }
                note = 'Every section is within its page and word limits';
                break;
            }
            case 'r-naming':
                note = 'EBIS renames every file to this pattern when it builds the pack';
                break;
            case 'r-font':
                note = 'Applied when EBIS exports your response';
                break;
            case 'r-portal':
                note = 'You upload the pack yourself. EBIS never submits for you';
                break;
        }
        return { rule, breaches, note };
    });
}
