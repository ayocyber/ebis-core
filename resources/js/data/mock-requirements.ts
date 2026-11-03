/**
 * What the extraction engine pulled out of a tender pack (stages 2–3),
 * shown on the requirements review page before eligibility runs.
 * Fictional sample data; every tender shares it until the backend exists.
 */
import { eligibilityRowsFor } from '@/data/mock-ebis';
import type { Requirement, Tender } from '@/types/ebis';

/** ING-04: tender details, each with where it was read from */
export interface ExtractedField {
    key: 'buyer' | 'reference' | 'deadline' | 'clarification' | 'value' | 'lots' | 'portal';
    label: string;
    value: string;
    /** Where EBIS read it, or undefined if it couldn't find it */
    source?: string;
    confidence: number;
    required?: boolean;
    input?: 'text' | 'datetime-local' | 'number';
}

/** ING-02 / TUN-06: what was read and what couldn't be */
export interface ReadDocument {
    id: string;
    name: string;
    pages?: number;
    method: 'text' | 'ocr' | 'spreadsheet';
    /** Pages or parts EBIS could not read reliably */
    problems: { id: string; location: string; problem: string }[];
}

/** TUN-04: format rules the validation stage checks */
export interface SubmissionRule {
    id: string;
    label: string;
    value: string;
    source: string;
}

/** TUN-02: extraction confidence per requirement code (0–1) */
const extractionConfidence: Record<string, number> = {
    'M-01': 0.97,
    'M-02': 0.98,
    'M-03': 0.99,
    'M-04': 0.96,
    'M-05': 0.94,
    'M-06': 0.95,
    'M-07': 0.97,
    'M-08': 0.93,
    'M-09': 0.66,
    'M-10': 0.88,
    'M-11': 0.95,
    'S-01': 0.92,
    'S-02': 0.9,
    'S-03': 0.81,
    'S-04': 0.96,
    'S-05': 0.89,
    'I-01': 0.84,
    'I-02': 0.58,
};

/** Requirements below this extraction confidence are flagged for the user. */
export const EXTRACTION_THRESHOLD = 0.7;

export interface ExtractedRequirement extends Requirement {
    extractionConfidence: number;
}

export function extractedRequirements(tender: Tender): ExtractedRequirement[] {
    const fromMatrix = eligibilityRowsFor(tender.id).map((r) => ({
        ...r.requirement,
        extractionConfidence: extractionConfidence[r.requirement.code] ?? 0.9,
    }));

    // A likely false positive: a sentence that reads like a requirement but only describes the buyer.
    const candidate: ExtractedRequirement = {
        id: 'req-x01',
        tenderId: tender.id,
        code: 'I-03',
        title: 'TUPE may apply',
        text: 'Staff transfer regulations (TUPE) may apply to the incumbent support team.',
        category: 'informational',
        topic: 'legal',
        source: {
            documentId: 'doc-spec',
            documentName: 'Specification - Network Infrastructure.pdf',
            page: 41,
            section: '§ 9.4',
            quote: 'The Council’s current support arrangements are provided in-house; TUPE is not expected to apply but bidders should satisfy themselves.',
        },
        extractionConfidence: 0.42,
    };

    return [...fromMatrix, candidate];
}

export function tenderFields(t: Tender): ExtractedField[] {
    const dt = (iso: string) => iso.slice(0, 16);
    return [
        { key: 'buyer', label: 'Buyer', value: t.buyer.name, source: 'ITT p.1', confidence: 0.99, required: true },
        { key: 'reference', label: 'Reference', value: t.reference, source: 'ITT p.1', confidence: 0.99, required: true },
        {
            key: 'deadline',
            label: 'Submission deadline',
            value: dt(t.deadline),
            source: 'ITT p.3 · §2.1',
            confidence: 0.97,
            required: true,
            input: 'datetime-local',
        },
        {
            key: 'clarification',
            label: 'Clarification questions close',
            value: t.clarificationDeadline ? dt(t.clarificationDeadline) : '',
            source: t.clarificationDeadline ? 'ITT p.3 · §2.1' : undefined,
            confidence: t.clarificationDeadline ? 0.93 : 0,
            input: 'datetime-local',
        },
        {
            key: 'value',
            label: 'Estimated value (£)',
            value: t.estimatedValue ? String(t.estimatedValue.amount) : '',
            source: t.estimatedValue ? 'Find a Tender notice' : undefined,
            confidence: t.estimatedValue ? 0.9 : 0,
            input: 'number',
        },
        { key: 'lots', label: 'Lots', value: t.lots ? String(t.lots) : '', source: undefined, confidence: 0, input: 'number' },
        { key: 'portal', label: 'Submit through', value: 'Northshire e-Tendering (In-Tend)', source: 'ITT p.4 · §3.2', confidence: 0.86 },
    ];
}

export function documentsRead(t: Tender): ReadDocument[] {
    const base: Record<string, Omit<ReadDocument, 'id' | 'name' | 'pages'>> = {
        'doc-itt': { method: 'text', problems: [] },
        'doc-spec': {
            method: 'ocr',
            problems: [
                {
                    id: 'p-spec-41',
                    location: 'Pages 41–42 · site schedule table',
                    problem: 'Scanned table with low print quality. Some site names and cable counts may be wrong.',
                },
            ],
        },
        'doc-eval': { method: 'text', problems: [] },
        'doc-price': {
            method: 'spreadsheet',
            problems: [
                {
                    id: 'p-price-hidden',
                    location: 'Sheet “Rates_Calc” (hidden)',
                    problem: 'Hidden, password-protected sheet. EBIS could not read it.',
                },
            ],
        },
        'doc-forms': { method: 'text', problems: [] },
    };
    return t.documents.map((d) => ({ id: d.id, name: d.name, pages: d.pages, ...(base[d.id] ?? { method: 'text', problems: [] }) }));
}

export function submissionRules(): SubmissionRule[] {
    return [
        { id: 'r-portal', label: 'Where', value: 'Upload to the buyer’s e-tendering portal. Email submissions are rejected.', source: 'ITT §3.2' },
        { id: 'r-format', label: 'File types', value: 'PDF for responses and forms; pricing in the original .xlsx', source: 'ITT §7.1' },
        { id: 'r-size', label: 'File size', value: 'Up to 20 MB per file', source: 'ITT §7.1' },
        { id: 'r-pages', label: 'Page limits', value: 'Technical approach: 15 pages. Case studies: 2 pages each.', source: 'Award criteria p.4' },
        { id: 'r-font', label: 'Formatting', value: 'Arial 11pt minimum, A4', source: 'ITT §7.2' },
        { id: 'r-naming', label: 'File naming', value: '[Reference]_[Supplier]_[Document]', source: 'ITT §7.4' },
    ];
}
