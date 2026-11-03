/**
 * Mock data for previewing the EBIS Core frontend before the API exists.
 * Swap these exports for Inertia props once the backend lands.
 *
 * Scenario: Bluewave Networks Ltd, a 40-person network integrator in Sheffield,
 * is bidding for UK public sector contracts under the Procurement Act 2023.
 * Every buyer, company and person here is fictional.
 */
import { workingDaysBetween } from '@/lib/decision';
import { assessmentMethod, classifyGap, staleFact } from '@/lib/rules';
import type {
    Assessment,
    AssessmentStatus,
    EligibilityRow,
    Gap,
    ProfileFact,
    Requirement,
    RequirementCategory,
    RequirementTopic,
    Tender,
    TenderDocument,
} from '@/types/ebis';

/* ------------------------------------------------------------------ */
/* Tenders                                                             */
/* ------------------------------------------------------------------ */

const packDocs: TenderDocument[] = [
    {
        id: 'doc-itt',
        name: 'NCC-ICT-2026-014 Invitation to Tender.pdf',
        kind: 'pdf',
        sizeBytes: 2_480_000,
        pages: 46,
        role: 'Invitation to tender',
        uploadedAt: '2026-10-28T09:12:00Z',
    },
    {
        id: 'doc-spec',
        name: 'Specification - Network Infrastructure.pdf',
        kind: 'pdf',
        sizeBytes: 5_920_000,
        pages: 88,
        role: 'Specification',
        uploadedAt: '2026-10-28T09:12:00Z',
    },
    {
        id: 'doc-eval',
        name: 'Award Criteria & Scoring Methodology.docx',
        kind: 'docx',
        sizeBytes: 412_000,
        pages: 12,
        role: 'Award criteria',
        uploadedAt: '2026-10-28T09:12:00Z',
    },
    {
        id: 'doc-price',
        name: 'Pricing Schedule.xlsx',
        kind: 'xlsx',
        sizeBytes: 188_000,
        role: 'Pricing schedule',
        uploadedAt: '2026-10-28T09:13:00Z',
    },
    { id: 'doc-forms', name: 'Tender Response Forms.zip', kind: 'zip', sizeBytes: 3_140_000, role: 'Forms', uploadedAt: '2026-10-28T09:13:00Z' },
];

export const tenders: Tender[] = [
    {
        id: 'tnd-001',
        reference: 'NCC/ICT/2026/014',
        title: 'Supply, installation and support of enterprise network infrastructure across 12 council sites',
        summary:
            'Design, supply and commissioning of LAN/WAN, structured cabling, Wi-Fi and a central network operations centre for Northshire County Council, with 3 years of support.',
        buyer: { name: 'Northshire County Council', type: 'local', location: 'Northshire, England' },
        source: { kind: 'upload' },
        publishedAt: '2026-10-20T08:00:00Z',
        clarificationDeadline: '2026-11-12T16:00:00Z',
        deadline: '2026-11-26T12:00:00Z',
        estimatedValue: { amount: 3_200_000, currency: 'GBP' },
        sector: 'ICT infrastructure',
        lots: 2,
        stage: 'eligibility',
        documents: packDocs,
        eligibilityScore: 72,
        owner: { name: 'Emma Richardson', initials: 'ER' },
        createdAt: '2026-10-28T09:12:00Z',
    },
    {
        id: 'tnd-002',
        reference: 'WBC/DIG/2026/031',
        title: 'Cloud migration and managed hosting for shared council services',
        summary: 'Migration of 40+ workloads to UK-sovereign hosting with managed backup and disaster recovery for 24 months.',
        buyer: { name: 'Westmoor Borough Council', type: 'local', location: 'Westmoor, West Midlands' },
        source: { kind: 'feed', feed: 'Find a Tender', url: 'https://www.find-tender.service.gov.uk' },
        publishedAt: '2026-10-14T08:00:00Z',
        deadline: '2026-11-18T12:00:00Z',
        estimatedValue: { amount: 2_400_000, currency: 'GBP' },
        sector: 'Cloud services',
        stage: 'gaps',
        documents: packDocs.slice(0, 3),
        eligibilityScore: 58,
        owner: { name: 'Tom Barker', initials: 'TB' },
        createdAt: '2026-10-15T11:40:00Z',
    },
    {
        id: 'tnd-003',
        reference: 'RNT/ICT/2026/007',
        title: 'IT service management platform and 3-year support',
        summary: 'Licensing, implementation and support of an ITSM platform covering incident, change and asset management.',
        buyer: { name: 'Riverside NHS Foundation Trust', type: 'nhs', location: 'Riverside, North West' },
        source: { kind: 'feed', feed: 'Contracts Finder', url: 'https://www.contractsfinder.service.gov.uk' },
        publishedAt: '2026-10-25T08:00:00Z',
        deadline: '2026-12-09T12:00:00Z',
        estimatedValue: { amount: 640_000, currency: 'GBP' },
        sector: 'Software',
        stage: 'requirements',
        documents: packDocs.slice(0, 2),
        owner: { name: 'Emma Richardson', initials: 'ER' },
        createdAt: '2026-10-29T14:05:00Z',
    },
    {
        id: 'tnd-004',
        reference: 'NGU/EST/2026/022',
        title: 'Campus Wi-Fi upgrade across six university buildings',
        summary: 'Wi-Fi 7 access points, switching upgrades and a managed service for six teaching and residential buildings.',
        buyer: { name: 'Northgate University', type: 'education', location: 'Northgate, Yorkshire' },
        source: { kind: 'upload' },
        publishedAt: '2026-10-02T08:00:00Z',
        deadline: '2026-11-06T12:00:00Z',
        estimatedValue: { amount: 920_000, currency: 'GBP' },
        sector: 'Education IT',
        stage: 'drafting',
        documents: packDocs.slice(0, 4),
        eligibilityScore: 88,
        owner: { name: 'Priya Nair', initials: 'PN' },
        createdAt: '2026-10-04T10:00:00Z',
    },
    {
        id: 'tnd-005',
        reference: 'HHP/DIG/2026/118',
        title: 'Rugged tablets and field connectivity for community health teams',
        summary: 'Supply of 350 rugged tablets with 5G connectivity, device management and 12 months of data.',
        buyer: { name: 'Highland Health Partnership', type: 'devolved', location: 'Inverness, Scotland' },
        source: { kind: 'feed', feed: 'Public Contracts Scotland', url: 'https://www.publiccontractsscotland.gov.uk' },
        publishedAt: '2026-10-30T08:00:00Z',
        deadline: '2026-12-01T17:00:00Z',
        estimatedValue: { amount: 410_000, currency: 'GBP' },
        sector: 'Hardware',
        stage: 'extraction',
        documents: packDocs.slice(0, 1),
        owner: { name: 'Tom Barker', initials: 'TB' },
        createdAt: '2026-11-01T08:20:00Z',
    },
];

/* ------------------------------------------------------------------ */
/* Company profile facts                                               */
/* ------------------------------------------------------------------ */

export const profileFacts: Record<string, ProfileFact> = {
    companiesHouse: {
        id: 'pf-ch',
        label: 'Companies House registration',
        value: 'Company no. 08812345 — private limited company, incorporated 14 Mar 2013',
        source: 'certificate',
        documentName: 'Certificate of Incorporation.pdf',
        verifiedAt: '2026-09-01T00:00:00Z',
    },
    confirmation: {
        id: 'pf-cs01',
        label: 'Confirmation statement',
        value: 'Last filed 14 Mar 2025 — 2026 statement not on file',
        source: 'company_profile',
    },
    tax: {
        id: 'pf-tax',
        label: 'HMRC tax compliance',
        value: 'No outstanding returns or liabilities · VAT reg. GB 184 5520 31',
        source: 'company_profile',
        verifiedAt: '2026-09-01T00:00:00Z',
    },
    cyberEssentials: {
        id: 'pf-cep',
        label: 'Cyber Essentials Plus',
        value: 'Certificate IASME-CEP-018842',
        source: 'certificate',
        documentName: 'Cyber Essentials Plus 2025.pdf',
        verifiedAt: '2025-11-01T00:00:00Z',
        expiresAt: '2026-10-31T00:00:00Z',
    },
    employersLiability: {
        id: 'pf-el',
        label: 'Employer’s liability insurance',
        value: '£10m cover — Hiscox, renews Mar 2027',
        source: 'policy',
        documentName: 'Employers Liability Certificate.pdf',
        verifiedAt: '2026-03-02T00:00:00Z',
        expiresAt: '2027-03-01T00:00:00Z',
    },
    carbon: { id: 'pf-crp', label: 'Carbon Reduction Plan', value: 'Not on file', source: 'company_profile' },
    cdp: {
        id: 'pf-cdp',
        label: 'Central Digital Platform',
        value: 'Core supplier information submitted 4 Jul 2026 — unique ID SUP-2026-0012931',
        source: 'company_profile',
        verifiedAt: '2026-07-04T00:00:00Z',
    },
    turnover: {
        id: 'pf-turnover',
        label: 'Average annual turnover (3 yrs)',
        value: '£1.6m (FY23: £1.31m · FY24: £1.58m · FY25: £1.91m)',
        source: 'financial_statement',
        documentName: 'Audited Accounts FY23-FY25.pdf',
        verifiedAt: '2026-05-20T00:00:00Z',
    },
    audited: {
        id: 'pf-audited',
        label: 'Audited financial statements',
        value: 'FY2023, FY2024, FY2025 — audited by Hartley & Co. (ICAEW)',
        source: 'financial_statement',
        documentName: 'Audited Accounts FY23-FY25.pdf',
        verifiedAt: '2026-05-20T00:00:00Z',
    },
    bank: {
        id: 'pf-bank',
        label: 'Bank reference',
        value: 'Barclays letter dated 02 Jun 2026 (overdraft facility £250k)',
        source: 'company_profile',
        documentName: 'Barclays Bank Reference.pdf',
        verifiedAt: '2026-06-02T00:00:00Z',
    },
    cisco: {
        id: 'pf-cisco',
        label: 'OEM partnership',
        value: 'Cisco Select Partner (not Premier/Gold)',
        source: 'certificate',
        documentName: 'Cisco Partner Certificate.pdf',
        verifiedAt: '2026-01-15T00:00:00Z',
        expiresAt: '2027-01-15T00:00:00Z',
    },
    iso27001: {
        id: 'pf-iso27001',
        label: 'ISO/IEC 27001',
        value: 'Certified — cert no. IS 742219, BSI',
        source: 'certificate',
        documentName: 'ISO 27001 Certificate.pdf',
        verifiedAt: '2026-04-10T00:00:00Z',
        expiresAt: '2028-04-09T00:00:00Z',
    },
    iso9001: {
        id: 'pf-iso9001',
        label: 'ISO 9001',
        value: 'Certified — cert no. FS 701223, BSI',
        source: 'certificate',
        documentName: 'ISO 9001 Certificate.pdf',
        verifiedAt: '2026-04-10T00:00:00Z',
        expiresAt: '2027-11-30T00:00:00Z',
    },
    caseNhs: {
        id: 'pf-case-nhs',
        label: 'Case study — hospital campus network',
        value: 'Riverside NHS Foundation Trust HQ: 1,400-node LAN + Wi-Fi refresh, £1.4m, completed Aug 2024',
        source: 'case_study',
        documentName: 'Case Study - Riverside NHS.pdf',
    },
    caseCouncil: {
        id: 'pf-case-ebc',
        label: 'Case study — council WAN',
        value: 'Eastbrook District Council WAN, 9 sites, £0.9m, completed Feb 2023',
        source: 'case_study',
        documentName: 'Case Study - Eastbrook DC.pdf',
    },
    ccie: {
        id: 'pf-ccie',
        label: 'Lead network engineer',
        value: 'Daniel Okoro — CCIE #61840, 14 yrs experience, SC cleared',
        source: 'cv',
        documentName: 'CV - Daniel Okoro.pdf',
    },
    pm: {
        id: 'pf-pm',
        label: 'Project manager',
        value: 'Sarah Whitfield — PRINCE2 Practitioner, APM PMQ, 9 yrs',
        source: 'cv',
        documentName: 'CV - Sarah Whitfield.pdf',
    },
    staff: {
        id: 'pf-staff',
        label: 'Technical headcount',
        value: '38 engineers (12 Cisco-certified, 4 Fortinet NSE 4+), 6 with BPSS + SC clearance',
        source: 'company_profile',
    },
    insurance: {
        id: 'pf-ins',
        label: 'Professional indemnity',
        value: '£2m cover — Hiscox, renews Mar 2027',
        source: 'policy',
        documentName: 'PI Insurance Schedule.pdf',
        expiresAt: '2027-03-01T00:00:00Z',
    },
    socialValue: {
        id: 'pf-sv',
        label: 'Social value commitments',
        value: '2 apprentices a year, 78% of spend with Yorkshire suppliers, Real Living Wage employer',
        source: 'policy',
        documentName: 'Social Value Policy.pdf',
    },
    office: { id: 'pf-office', label: 'Registered office', value: 'Kelham Island, Sheffield, South Yorkshire', source: 'company_profile' },
};

/* ------------------------------------------------------------------ */
/* Requirements + assessments for tnd-001                              */
/* ------------------------------------------------------------------ */

interface Seed {
    code: string;
    title: string;
    text: string;
    category: RequirementCategory;
    topic: RequirementTopic;
    weight?: number;
    doc: 'doc-itt' | 'doc-spec' | 'doc-eval';
    page: number;
    section: string;
    quote: string;
    highlight?: string;
    status: AssessmentStatus;
    confidence: number;
    summary: string;
    reasoning: string;
    facts: (keyof typeof profileFacts)[];
    reviewed?: boolean;
    gap?: Omit<Gap, 'id' | 'requirementId' | 'status'> & { status?: Gap['status'] };
}

const seeds: Seed[] = [
    {
        code: 'M-01',
        title: 'Evidence of company registration',
        category: 'mandatory',
        topic: 'legal',
        doc: 'doc-itt',
        page: 6,
        section: '§ 5.1(a)',
        text: 'Companies House registration and an up-to-date confirmation statement.',
        quote: 'Suppliers must provide their Companies House registration number and a copy of their most recent confirmation statement, filed within the last 12 months.',
        highlight: 'filed within the last 12 months',
        status: 'partially_met',
        confidence: 0.88,
        summary: 'Registered, but the latest confirmation statement is over 12 months old.',
        reasoning:
            'Company no. 08812345 is on file. The most recent confirmation statement in the vault was filed on 14 Mar 2025, more than 12 months before the deadline. The 2026 statement may exist at Companies House but has not been uploaded.',
        facts: ['companiesHouse', 'confirmation'],
        reviewed: true,
        gap: {
            severity: 'fixable',
            title: 'Upload 2026 confirmation statement',
            evidence: { scope: 'company', title: 'Confirmation statement 2026', category: 'company' },
            description: 'The buyer asks for a statement filed within the last 12 months.',
            remedy: 'Download the 2026 confirmation statement from Companies House (or file it now — it is free online) and add it to the vault.',
            timeToCloseDays: 1,
            owner: 'Emma Richardson',
            cost: { amount: 0, currency: 'GBP' },
        },
    },
    {
        code: 'M-02',
        title: 'Tax compliance declaration',
        category: 'mandatory',
        topic: 'financial',
        doc: 'doc-itt',
        page: 6,
        section: '§ 5.1(b)',
        text: 'Confirm no outstanding tax returns or liabilities with HMRC.',
        quote: 'Suppliers must confirm that they have met all obligations relating to the payment of taxes and have no outstanding returns with HM Revenue & Customs.',
        status: 'met',
        confidence: 0.96,
        summary: 'Profile confirms no outstanding HMRC returns or liabilities.',
        reasoning: 'The company profile records full HMRC compliance, verified on 1 Sep 2026, and a valid VAT registration.',
        facts: ['tax'],
        reviewed: true,
    },
    {
        code: 'M-03',
        title: 'Cyber Essentials Plus certificate',
        category: 'mandatory',
        topic: 'certification',
        doc: 'doc-itt',
        page: 7,
        section: '§ 5.1(c)',
        text: 'A current Cyber Essentials Plus certificate valid at the contract start date.',
        quote: 'Bidders must hold a current Cyber Essentials Plus certificate valid at the contract start date of 1 February 2027.',
        highlight: 'valid at the contract start date of 1 February 2027',
        status: 'partially_met',
        confidence: 0.93,
        summary: 'You hold the certificate, but it expired on 31 Oct 2026.',
        reasoning:
            'The only Cyber Essentials Plus certificate in the vault expired on 31 Oct 2026, before the submission deadline. Expired evidence is stale, so the requirement is only partly met until a current certificate is uploaded.',
        facts: ['cyberEssentials'],
        gap: {
            severity: 'blocker',
            title: 'Renew Cyber Essentials Plus',
            evidence: { scope: 'company', title: 'Cyber Essentials Plus certificate', category: 'certificate' },
            description: 'An expired certificate fails the mandatory selection stage.',
            remedy: 'Book a reassessment with an IASME certification body. Run the internal vulnerability scan first so the audit passes first time.',
            timeToCloseDays: 10,
            owner: 'IT — Kemi Adebayo',
            cost: { amount: 1_850, currency: 'GBP' },
            status: 'in_progress',
        },
    },
    {
        code: 'M-04',
        title: 'Employer’s liability insurance',
        category: 'mandatory',
        topic: 'insurance',
        doc: 'doc-itt',
        page: 8,
        section: '§ 5.3(a)',
        text: 'Employer’s liability insurance of at least £5m per claim.',
        quote: 'Employer’s liability insurance with a minimum indemnity of £5,000,000 for any one occurrence.',
        status: 'met',
        confidence: 0.97,
        summary: '£10m cover with Hiscox, valid to Mar 2027.',
        reasoning: 'Cover of £10m exceeds the £5m minimum and stays valid past the deadline.',
        facts: ['employersLiability'],
        reviewed: true,
    },
    {
        code: 'M-05',
        title: 'Carbon Reduction Plan',
        category: 'mandatory',
        topic: 'legal',
        doc: 'doc-itt',
        page: 9,
        section: '§ 5.4',
        text: 'A published Carbon Reduction Plan committing to net zero by 2050.',
        quote: 'Suppliers must provide a Carbon Reduction Plan, approved by a director and published on their website, confirming their commitment to achieving Net Zero by 2050.',
        highlight: 'approved by a director and published on their website',
        status: 'unknown',
        confidence: 0.41,
        summary: 'No Carbon Reduction Plan found in the vault.',
        reasoning:
            'Nothing in the vault matches a Carbon Reduction Plan. It may exist on the website but has not been added, so this cannot be confirmed either way.',
        facts: ['carbon'],
        gap: {
            severity: 'blocker',
            title: 'Publish a Carbon Reduction Plan',
            evidence: { scope: 'company', title: 'Carbon Reduction Plan', category: 'policy' },
            description: 'Mandatory pass/fail. Missing it fails the bid at selection stage.',
            remedy: 'Use the government Carbon Reduction Plan template. Report Scope 1, 2 and selected Scope 3 emissions, get a director’s sign-off and publish it on the website.',
            timeToCloseDays: 7,
            owner: 'Ops — Grace Lee',
            cost: { amount: 1_200, currency: 'GBP' },
        },
    },
    {
        code: 'M-06',
        title: 'Central Digital Platform registration',
        category: 'mandatory',
        topic: 'legal',
        doc: 'doc-itt',
        page: 5,
        section: '§ 4.2',
        text: 'Registered on the Central Digital Platform with core supplier information.',
        quote: 'All suppliers must be registered on the Central Digital Platform and share their core supplier information with the Council before the deadline.',
        status: 'met',
        confidence: 0.95,
        summary: 'Registered; core information submitted Jul 2026.',
        reasoning:
            'Registration and core supplier information are on file. Remember to share them with the Council in the platform before submission.',
        facts: ['cdp'],
    },
    {
        code: 'M-07',
        title: 'Minimum annual turnover',
        category: 'mandatory',
        topic: 'financial',
        doc: 'doc-itt',
        page: 9,
        section: '§ 5.2(a)',
        text: 'Average annual turnover of at least £2m over the last three years.',
        quote: 'Bidders shall demonstrate an average annual turnover of not less than £2,000,000 over the last three financial years.',
        highlight: 'not less than £2,000,000',
        status: 'not_met',
        confidence: 0.84,
        summary: 'Average turnover is £1.6m, below the £2m threshold.',
        reasoning:
            'Audited accounts give turnover of £1.31m, £1.58m and £1.91m; the average (£1.6m) is below £2m. The tender lets suppliers rely on a parent company guarantee or a consortium partner (§ 4.3), which could close this gap.',
        facts: ['turnover', 'audited'],
        gap: {
            severity: 'blocker',
            title: 'Turnover below £2m threshold',
            evidence: { scope: 'bid', title: 'Signed parent company guarantee', category: 'financial' },
            description: 'Fails financial standing unless another entity’s capacity is relied on.',
            remedy: 'Bid as a consortium with a larger partner, or provide a parent company guarantee as permitted by § 4.3. Agree terms before the clarification deadline.',
            timeToCloseDays: 14,
            owner: 'MD — James Oliver',
            cost: { amount: 4_500, currency: 'GBP' },
        },
    },
    {
        code: 'M-08',
        title: 'Audited accounts',
        category: 'mandatory',
        topic: 'financial',
        doc: 'doc-itt',
        page: 9,
        section: '§ 5.2(b)',
        text: 'Audited accounts for the last three financial years.',
        quote: 'Audited financial statements for the last three (3) financial years.',
        status: 'met',
        confidence: 0.95,
        summary: 'FY2023–FY2025 audited by an ICAEW firm.',
        reasoning: 'Three years of audited accounts are on file.',
        facts: ['audited'],
        reviewed: true,
    },
    {
        code: 'M-09',
        title: 'Bank reference letter',
        category: 'mandatory',
        topic: 'financial',
        doc: 'doc-itt',
        page: 10,
        section: '§ 5.2(c)',
        text: 'Bank reference dated within 3 months of the deadline.',
        quote: 'A reference letter from the bidder’s bank, dated no earlier than three months before the tender deadline.',
        highlight: 'no earlier than three months before the tender deadline',
        status: 'partially_met',
        confidence: 0.9,
        summary: 'Letter is dated Jun 2026 — too old.',
        reasoning: 'The Barclays letter is dated 2 Jun 2026, more than three months before the 26 Nov deadline.',
        facts: ['bank'],
        gap: {
            severity: 'fixable',
            title: 'Request a new bank reference',
            evidence: { scope: 'bid', title: 'Bank reference addressed to the Council', category: 'financial' },
            description: 'A stale reference letter can be rejected at selection.',
            remedy: 'Ask the Barclays relationship manager for a reference addressed to Northshire County Council.',
            timeToCloseDays: 3,
            owner: 'Finance — Kemi Adebayo',
            cost: { amount: 50, currency: 'GBP' },
        },
    },
    {
        code: 'M-10',
        title: 'OEM manufacturer authorisation',
        category: 'mandatory',
        topic: 'certification',
        doc: 'doc-spec',
        page: 14,
        section: '§ 2.4',
        text: 'Manufacturer authorisation letter for the proposed network equipment.',
        quote: 'Bidders must submit a Manufacturer’s Authorisation Form (MAF) from the OEM of the proposed core switching equipment, specific to this tender.',
        highlight: 'specific to this tender',
        status: 'unknown',
        confidence: 0.52,
        summary: 'Cisco partnership exists; tender-specific MAF not on file.',
        reasoning:
            'A Cisco Select partnership is on file, but the tender asks for an authorisation letter issued for this tender. None is in the vault.',
        facts: ['cisco'],
        gap: {
            severity: 'fixable',
            title: 'Obtain Cisco MAF',
            evidence: { scope: 'bid', title: 'Cisco manufacturer authorisation (MAF)', category: 'certificate' },
            description: 'Without a tender-specific letter, the technical offer can be rejected.',
            remedy: 'Request a MAF through the Cisco partner portal or the distributor (quote the tender reference).',
            timeToCloseDays: 5,
            owner: 'Presales — Daniel Okoro',
            cost: { amount: 0, currency: 'GBP' },
        },
    },
    {
        code: 'M-11',
        title: 'Professional indemnity insurance',
        category: 'mandatory',
        topic: 'insurance',
        doc: 'doc-itt',
        page: 8,
        section: '§ 5.3(b)',
        text: 'Professional indemnity cover of at least £2m.',
        quote: 'Professional indemnity insurance of not less than £2,000,000 in the aggregate.',
        status: 'met',
        confidence: 0.94,
        summary: '£2m cover in place to Mar 2027.',
        reasoning: 'Cover matches the minimum and stays valid past the deadline.',
        facts: ['insurance'],
    },
    {
        code: 'S-01',
        title: 'Similar projects in the last 5 years',
        category: 'scored',
        topic: 'experience',
        weight: 20,
        doc: 'doc-eval',
        page: 3,
        section: 'Criterion 1',
        text: 'Three contracts of similar scope and value (≥ £1m) in the last 5 years.',
        quote: 'Provide three (3) case studies of contracts of similar scope, each valued at not less than £1,000,000, completed within the last five years.',
        highlight: 'each valued at not less than £1,000,000',
        status: 'partially_met',
        confidence: 0.82,
        summary: '1 qualifying case study; 1 under the value threshold.',
        reasoning: 'Riverside NHS (£1.4m) qualifies. Eastbrook District Council (£0.9m) is below £1m. A third reference is needed for full marks.',
        facts: ['caseNhs', 'caseCouncil'],
        gap: {
            severity: 'minor',
            title: 'Add qualifying project references',
            evidence: { scope: 'company', title: 'Case study — 2025 university campus project', category: 'experience' },
            description: 'Losing up to 2/3 of a 20% criterion.',
            remedy: 'Write up the 2025 university campus project (£1.2m) as a case study and get a signed client reference.',
            timeToCloseDays: 4,
            owner: 'Bids — Emma Richardson',
            cost: { amount: 0, currency: 'GBP' },
        },
    },
    {
        code: 'S-02',
        title: 'Key personnel qualifications',
        category: 'scored',
        topic: 'personnel',
        weight: 15,
        doc: 'doc-eval',
        page: 4,
        section: 'Criterion 2',
        text: 'Named project manager and lead engineer with relevant certifications.',
        quote: 'CVs of the proposed Project Manager (PRINCE2 or equivalent) and Lead Network Engineer (CCIE or equivalent).',
        status: 'met',
        confidence: 0.95,
        summary: 'PRINCE2 project manager and CCIE lead engineer on file.',
        reasoning: 'Both named roles have CVs with the required certifications.',
        facts: ['pm', 'ccie'],
        reviewed: true,
    },
    {
        code: 'S-03',
        title: 'Technical approach & methodology',
        category: 'scored',
        topic: 'technical',
        weight: 25,
        doc: 'doc-eval',
        page: 4,
        section: 'Criterion 3',
        text: 'Detailed approach, implementation plan and risk management.',
        quote: 'A detailed technical approach, implementation plan and risk register (max. 15 pages).',
        status: 'unknown',
        confidence: 0.35,
        summary: 'Written during bid drafting — not assessed yet.',
        reasoning: 'This is answered in the bid itself, so it cannot be assessed against the profile.',
        facts: ['staff'],
        gap: {
            severity: 'minor',
            title: 'Write the technical approach',
            description: 'Worth 25% of the quality score. Nothing in the profile answers it, so it has to be written for this bid.',
            remedy: 'Draft the approach, implementation plan and risk register in the bid editor. Keep it under 15 pages.',
            timeToCloseDays: 5,
            owner: 'Bid lead — Emma Richardson',
        },
    },
    {
        code: 'S-04',
        title: 'Information security certification',
        category: 'scored',
        topic: 'certification',
        weight: 10,
        doc: 'doc-eval',
        page: 5,
        section: 'Criterion 4',
        text: 'ISO/IEC 27001 and ISO 9001 certification.',
        quote: 'ISO/IEC 27001 and ISO 9001 certification from a UKAS-accredited body.',
        status: 'met',
        confidence: 0.96,
        summary: 'Both certificates current, issued by BSI.',
        reasoning: 'ISO 27001 valid to 2028 and ISO 9001 valid to Nov 2027, both issued by a UKAS-accredited body.',
        facts: ['iso27001', 'iso9001'],
    },
    {
        code: 'S-05',
        title: 'Social value',
        category: 'scored',
        topic: 'social_value',
        weight: 10,
        doc: 'doc-eval',
        page: 6,
        section: 'Criterion 5',
        text: 'Commitments to local jobs, skills and supply chain in Northshire.',
        quote: 'Describe the social value you will deliver through this contract, including local employment, skills and spend with local SMEs.',
        status: 'met',
        confidence: 0.86,
        summary: 'Apprenticeships, local spend and Real Living Wage policy on file.',
        reasoning: 'The social value policy covers jobs, skills and local spend. Tailor the commitments to Northshire in the bid.',
        facts: ['socialValue', 'office'],
    },
    {
        code: 'I-01',
        title: 'Staff security vetting',
        category: 'informational',
        topic: 'personnel',
        doc: 'doc-spec',
        page: 22,
        section: '§ 6.2',
        text: 'Staff working on site must hold BPSS clearance.',
        quote: 'All supplier personnel requiring access to Council premises must hold a valid Baseline Personnel Security Standard (BPSS) check.',
        status: 'met',
        confidence: 0.91,
        summary: '6 engineers hold BPSS and SC clearance.',
        reasoning: 'Enough cleared staff to run the on-site work.',
        facts: ['staff'],
    },
    {
        code: 'I-02',
        title: 'Form of tender signed by a director',
        category: 'informational',
        topic: 'submission',
        doc: 'doc-itt',
        page: 15,
        section: '§ 9.1',
        text: 'Signed Form of Tender and declarations.',
        quote: 'The Form of Tender and all declarations must be signed by a director or authorised signatory and uploaded with the tender response.',
        status: 'unknown',
        confidence: 0.45,
        summary: 'Signed at sign-off; not yet prepared.',
        reasoning: 'The form is signed after pricing. Flagged so it is not forgotten.',
        facts: ['office'],
        gap: {
            severity: 'minor',
            title: 'Complete and sign the Form of Tender',
            description: 'An unsigned Form of Tender gets the bid rejected without scoring.',
            remedy: 'Fill it in on the documents checklist once the price is final, then have a director sign it.',
            timeToCloseDays: 1,
            owner: 'Director — James Oliver',
        },
    },
];

function buildRows(tenderId: string): EligibilityRow[] {
    const docById = Object.fromEntries(packDocs.map((d) => [d.id, d]));
    const tender = tenders.find((t) => t.id === tenderId);
    const deadline = tender ? new Date(tender.deadline) : new Date(Date.now() + 30 * 86_400_000);
    const daysLeft = workingDaysBetween(new Date(), deadline);

    return seeds.map((seed, index) => {
        const id = `req-${String(index + 1).padStart(2, '0')}`;
        const doc = docById[seed.doc];
        const source = { documentId: doc.id, documentName: doc.name, page: seed.page, section: seed.section };

        const requirement: Requirement = {
            id,
            tenderId,
            code: seed.code,
            title: seed.title,
            text: seed.text,
            category: seed.category,
            topic: seed.topic,
            weight: seed.weight,
            source: { ...source, quote: seed.quote },
        };

        const facts = seed.facts.map((key) => profileFacts[key]);
        const stale = staleFact(facts, deadline);
        const method = assessmentMethod(seed.topic);

        const assessment: Assessment = {
            id: `asm-${id}`,
            requirementId: id,
            // EVD-02: stale evidence can at best be partly met
            status: stale && seed.status === 'met' ? 'partially_met' : seed.status,
            method,
            stale: stale ? { factLabel: stale.label, expiresAt: stale.expiresAt! } : undefined,
            confidence: seed.confidence,
            summary: seed.summary,
            assessedAt: '2026-11-01T15:42:00Z',
            assessedBy: 'ebis-engine',
            reviewed: seed.reviewed ?? false,
            evidence: {
                id: `ev-${id}`,
                requirementId: id,
                clauseQuote: seed.quote,
                highlight: seed.highlight,
                source,
                profileFacts: facts,
                reasoning: seed.reasoning,
            },
        };

        // GAP-02: severity depends on whether the fix fits in the time left, not on the seed
        const gap: Gap | undefined = seed.gap
            ? {
                  id: `gap-${id}`,
                  requirementId: id,
                  status: 'open',
                  ...seed.gap,
                  severity: classifyGap(seed.gap.timeToCloseDays, seed.category, daysLeft),
              }
            : undefined;

        return { requirement, assessment, gap };
    });
}

export const eligibilityRowsByTender: Record<string, EligibilityRow[]> = {
    'tnd-001': buildRows('tnd-001'),
};

export function findTender(id: string): Tender | undefined {
    return tenders.find((t) => t.id === id);
}

/** Every tender shares the sample matrix until real data exists. */
export function eligibilityRowsFor(tenderId: string): EligibilityRow[] {
    return eligibilityRowsByTender[tenderId] ?? buildRows(tenderId);
}

/** Rows that carry a gap — the input to stage 5. */
export function gapRowsFor(tenderId: string): EligibilityRow[] {
    return eligibilityRowsFor(tenderId).filter((r) => r.gap);
}
