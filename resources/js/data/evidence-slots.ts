/**
 * The documents UK public tenders ask for most often, used to guide a new
 * company through setting up its vault at registration.
 *
 * `suggest` stands in for the extraction engine (PRF-04): it returns what EBIS
 * would read from the file. Nothing is saved until the user confirms it.
 */
import type { VaultCategory } from '@/types/ebis';

export interface Suggestion {
    issuer?: string;
    reference?: string;
    expiresInDays?: number;
    /** One headline fact, e.g. "Cover: £10m any one occurrence" */
    fact?: string;
}

export interface EvidenceSlot {
    id: string;
    title: string;
    category: VaultCategory;
    tier: 'essential' | 'recommended';
    why: string;
    /** How many tender requirements this typically answers */
    unlocks: number;
    multiple?: boolean;
    keywords: RegExp;
    suggest: Suggestion;
}

export const evidenceSlots: EvidenceSlot[] = [
    {
        id: 'incorp',
        title: 'Certificate of incorporation',
        category: 'company',
        tier: 'essential',
        why: 'Proves you are a registered company. Asked for in almost every tender.',
        unlocks: 2,
        keywords: /incorporat|companies.?house|registration/i,
        suggest: { issuer: 'Companies House', fact: 'Private limited company, England and Wales' },
    },
    {
        id: 'accounts',
        title: 'Latest accounts',
        category: 'financial',
        tier: 'essential',
        why: 'Used to check turnover and financial standing. Upload 2–3 years if you have them.',
        unlocks: 3,
        keywords: /accounts|financial.?statement|annual.?report/i,
        suggest: { fact: 'Turnover for the last 3 financial years' },
    },
    {
        id: 'el',
        title: 'Employer’s liability insurance',
        category: 'insurance',
        tier: 'essential',
        why: 'A legal requirement if you employ staff. Buyers usually want £5m or more.',
        unlocks: 1,
        keywords: /employer/i,
        suggest: { issuer: 'Your insurer', expiresInDays: 300, fact: 'Cover: £10m any one occurrence' },
    },
    {
        id: 'pl',
        title: 'Public liability insurance',
        category: 'insurance',
        tier: 'essential',
        why: 'Needed for any work on the buyer’s premises.',
        unlocks: 1,
        keywords: /public.?liab/i,
        suggest: { issuer: 'Your insurer', expiresInDays: 300, fact: 'Cover: £5m any one occurrence' },
    },
    {
        id: 'pi',
        title: 'Professional indemnity insurance',
        category: 'insurance',
        tier: 'essential',
        why: 'Required for advice, design and IT services contracts.',
        unlocks: 1,
        keywords: /indemnity|\bpi\b/i,
        suggest: { issuer: 'Your insurer', expiresInDays: 300, fact: 'Cover: £2m aggregate' },
    },
    {
        id: 'cep',
        title: 'Cyber Essentials (or Plus)',
        category: 'certificate',
        tier: 'essential',
        why: 'Required for most government contracts that handle personal data or IT systems.',
        unlocks: 1,
        keywords: /cyber/i,
        suggest: { issuer: 'IASME Consortium', reference: 'IASME-CEP-', expiresInDays: 365, fact: 'Cyber Essentials Plus' },
    },
    {
        id: 'iso',
        title: 'ISO certificates',
        category: 'certificate',
        tier: 'recommended',
        why: 'ISO 9001, 27001 or 14001 earn marks and are sometimes mandatory.',
        unlocks: 2,
        multiple: true,
        keywords: /iso|9001|27001|14001/i,
        suggest: { issuer: 'BSI', expiresInDays: 900, fact: 'UKAS-accredited certification' },
    },
    {
        id: 'case',
        title: 'Case studies',
        category: 'experience',
        tier: 'recommended',
        why: 'Your best proof of experience. Aim for three recent projects with values.',
        unlocks: 2,
        multiple: true,
        keywords: /case.?stud|project|reference.?site/i,
        suggest: { fact: 'Project value, client and completion date' },
    },
    {
        id: 'cv',
        title: 'CVs of key people',
        category: 'people',
        tier: 'recommended',
        why: 'Tenders score named staff and their qualifications.',
        unlocks: 1,
        multiple: true,
        keywords: /\bcv\b|resume|curriculum/i,
        suggest: { fact: 'Role, years of experience and certifications' },
    },
    {
        id: 'crp',
        title: 'Carbon Reduction Plan',
        category: 'policy',
        tier: 'recommended',
        why: 'Pass/fail in many central and local government tenders.',
        unlocks: 1,
        keywords: /carbon|net.?zero/i,
        suggest: { expiresInDays: 365, fact: 'Net zero by 2050, signed by a director' },
    },
    {
        id: 'sv',
        title: 'Social value policy',
        category: 'policy',
        tier: 'recommended',
        why: 'Social value is worth at least 10% of the score in most public tenders.',
        unlocks: 1,
        keywords: /social.?value/i,
        suggest: { expiresInDays: 365, fact: 'Jobs, skills and local spend commitments' },
    },
    {
        id: 'hs',
        title: 'Health and safety policy',
        category: 'policy',
        tier: 'recommended',
        why: 'Required if you have five or more staff, and checked at selection stage.',
        unlocks: 1,
        keywords: /health|safety|h&s/i,
        suggest: { expiresInDays: 365, fact: 'Signed by a director, reviewed yearly' },
    },
];

export function classify(fileName: string): EvidenceSlot | undefined {
    return evidenceSlots.find((s) => s.keywords.test(fileName));
}
