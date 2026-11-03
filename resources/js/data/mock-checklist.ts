/**
 * The forms and documents a tender pack asks the supplier to return (BID-02).
 * In production these come from the extraction engine reading the ITT's
 * submission instructions; every tender shares this sample list for now.
 */
import { companyProfile } from '@/data/mock-vault';
import type { ChecklistItem, ChecklistProgress } from '@/types/ebis';

const p = companyProfile;

const signatory = [
    { id: 'signatory', label: 'Signed by (full name)', hint: 'A director or someone authorised to sign for the company' },
    { id: 'position', label: 'Position' },
    { id: 'date', label: 'Date signed' },
];

export const checklistItems: ChecklistItem[] = [
    /* Forms to complete ------------------------------------------------ */
    {
        id: 'cl-fot',
        kind: 'form',
        title: 'Form of Tender',
        why: 'Your formal offer. Unsigned or missing, the bid is rejected without being scored.',
        source: 'ITT §7.3 · Form 1',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'Form01_FormOfTender',
        signature: true,
        fields: [
            { id: 'legal', label: 'Legal name of supplier', prefill: p.legalName, from: 'Company profile' },
            { id: 'number', label: 'Companies House number', prefill: p.companyNumber, from: 'Companies House' },
            { id: 'office', label: 'Registered office', prefill: p.registeredOffice, from: 'Company profile' },
            { id: 'price', label: 'Total tender price (ex VAT)', hint: 'Must match the total on your pricing schedule' },
            { id: 'validity', label: 'Offer valid for', prefill: '90 days', from: 'ITT §7.5' },
            ...signatory,
        ],
    },
    {
        id: 'cl-cdp',
        kind: 'form',
        title: 'Supplier information (Central Digital Platform)',
        why: 'Under the Procurement Act 2023 buyers read your core details from the Central Digital Platform. You give them a share code.',
        source: 'ITT §4.1',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'Form02_SupplierInformation',
        fields: [
            { id: 'cdp', label: 'Central Digital Platform ID', prefill: p.cdpId, from: 'Company profile' },
            { id: 'share', label: 'Share code', hint: 'Generate a new one on the Central Digital Platform for this tender' },
        ],
    },
    {
        id: 'cl-excl',
        kind: 'form',
        title: 'Exclusion grounds and conflicts of interest declaration',
        why: 'Confirms none of the mandatory or discretionary exclusion grounds apply to you or your subcontractors.',
        source: 'ITT §4.3 · Form 3',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'Form03_ExclusionDeclaration',
        signature: true,
        fields: [
            { id: 'legal', label: 'Legal name of supplier', prefill: p.legalName, from: 'Company profile' },
            { id: 'conflicts', label: 'Conflicts of interest to declare', prefill: 'None', from: 'Last declaration (Sep 2026)' },
            ...signatory,
        ],
    },
    {
        id: 'cl-collusion',
        kind: 'form',
        title: 'Non-collusion and anti-canvassing certificate',
        why: 'States that your price was set independently and you have not lobbied the evaluators.',
        source: 'ITT §7.3 · Form 4',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'Form04_NonCollusion',
        signature: true,
        fields: [{ id: 'legal', label: 'Legal name of supplier', prefill: p.legalName, from: 'Company profile' }, ...signatory],
    },
    {
        id: 'cl-foi',
        kind: 'form',
        title: 'Commercially sensitive information schedule',
        why: 'Lists anything you want withheld if someone makes a Freedom of Information request.',
        source: 'ITT §9.2 · Form 5',
        need: 'required',
        formats: ['pdf', 'docx'],
        fileStem: 'Form05_CommerciallySensitive',
        fields: [{ id: 'items', label: 'Information to withhold', prefill: 'Pricing schedule; staff day rates', from: 'Your last bid' }],
    },
    {
        id: 'cl-subcon',
        kind: 'form',
        title: 'Subcontractor declaration',
        why: 'Names each subcontractor and what they will do.',
        source: 'ITT §4.4 · Form 6',
        need: 'conditional',
        condition: 'Only if you will use subcontractors',
        formats: ['pdf'],
        fileStem: 'Form06_Subcontractors',
        signature: true,
        fields: [{ id: 'names', label: 'Subcontractors and their role' }, ...signatory],
    },

    /* Bid-specific files ---------------------------------------------- */
    {
        id: 'cl-pricing',
        kind: 'bid',
        title: 'Pricing schedule',
        why: 'Must be returned in the buyer’s spreadsheet. Converting it to PDF or changing the layout can void the bid.',
        source: 'ITT §8 · Pricing Schedule.xlsx',
        need: 'required',
        formats: ['xlsx'],
        fileStem: 'Pricing',
    },
    {
        id: 'cl-maf',
        kind: 'bid',
        title: 'Manufacturer authorisation letter (Cisco)',
        why: 'Proves Cisco authorises you to supply and support their equipment on this contract.',
        source: 'Specification §2.6',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'ManufacturerAuthorisation',
    },

    /* From the evidence vault ----------------------------------------- */
    {
        id: 'cl-el',
        kind: 'company',
        title: 'Employer’s liability insurance certificate',
        why: 'Minimum £5m cover.',
        source: 'ITT §5.2',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'Insurance_EmployersLiability',
        vaultMatch: 'employer',
    },
    {
        id: 'cl-pl',
        kind: 'company',
        title: 'Public liability insurance certificate',
        why: 'Minimum £5m cover.',
        source: 'ITT §5.2',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'Insurance_PublicLiability',
        vaultMatch: 'public liability',
    },
    {
        id: 'cl-pi',
        kind: 'company',
        title: 'Professional indemnity insurance certificate',
        why: 'Minimum £2m cover.',
        source: 'ITT §5.2',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'Insurance_ProfessionalIndemnity',
        vaultMatch: 'professional indemnity',
    },
    {
        id: 'cl-cep',
        kind: 'company',
        title: 'Cyber Essentials Plus certificate',
        why: 'Must be valid on the submission deadline.',
        source: 'ITT §5.4',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'CyberEssentialsPlus',
        vaultMatch: 'cyber essentials',
    },
    {
        id: 'cl-iso',
        kind: 'company',
        title: 'ISO/IEC 27001 certificate',
        why: 'Scored under quality. Include the scope page.',
        source: 'ITT §5.4',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'ISO27001',
        vaultMatch: '27001',
    },
    {
        id: 'cl-accounts',
        kind: 'company',
        title: 'Audited accounts (last two years)',
        why: 'Used for the economic and financial standing check.',
        source: 'ITT §5.1',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'Accounts',
        vaultMatch: 'accounts',
    },
    {
        id: 'cl-crp',
        kind: 'company',
        title: 'Carbon Reduction Plan',
        why: 'Pass/fail. Must follow the PPN 006 template and be signed by a director.',
        source: 'ITT §5.6',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'CarbonReductionPlan',
        vaultMatch: 'carbon reduction',
        missingId: 'miss-crp',
    },

    /* Written response ------------------------------------------------- */
    {
        id: 'cl-response',
        kind: 'response',
        title: 'Quality response',
        why: 'Your answers to the scored questions, exported from the bid editor.',
        source: 'ITT §6 · Response template',
        need: 'required',
        formats: ['pdf'],
        fileStem: 'QualityResponse',
    },
];

/** What a team would typically have done already by the time they open the checklist. */
export const checklistSeed: Record<string, ChecklistProgress> = {
    'cl-pricing': {
        fileName: 'Pricing Schedule - Bluewave v3.xlsx',
        uploadedAt: '2026-11-02T10:14:00Z',
        uploadedBy: 'Tom Barker',
    },
    'cl-cdp': { fields: { cdp: p.cdpId } },
};

export function checklistFor(tenderId: string): ChecklistItem[] {
    void tenderId;
    return checklistItems;
}
