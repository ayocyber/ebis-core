/**
 * Mock bid for tnd-001 (Northshire County Council network tender).
 * Sections map tender requirements (by code) to the part of the response that answers them.
 */
import { eligibilityRowsFor } from '@/data/mock-ebis';
import type { BidSection } from '@/types/ebis';

interface SectionSeed extends Omit<BidSection, 'requirementIds' | 'citations' | 'warnings'> {
    codes: string[];
    warnings?: BidSection['warnings'];
}

const seeds: SectionSeed[] = [
    {
        id: 'sec-01',
        title: 'Supplier information and legal standing',
        codes: ['M-01', 'M-02', 'M-06'],
        status: 'complete',
        assignee: 'Emma Richardson',
        body: 'Bluewave Networks Ltd is a private limited company registered in England and Wales (company no. 08812345) since March 2013. We have no outstanding tax returns or liabilities with HM Revenue & Customs and are registered on the Central Digital Platform.',
    },
    {
        id: 'sec-02',
        title: 'Economic and financial standing',
        codes: ['M-07', 'M-08', 'M-09'],
        status: 'drafting',
        assignee: 'Kemi Adebayo',
        body: 'Our audited accounts for FY2023 to FY2025 show steady growth, with turnover rising from £1.31m to £1.91m. To meet the £2m average turnover requirement we will rely on a parent company guarantee as permitted by section 4.3.',
        warnings: [
            {
                id: 'w-02-1',
                excerpt: 'rely on a parent company guarantee',
                message: 'No signed parent company guarantee is in the vault yet. Keep this as a draft until it is.',
                severity: 'error',
            },
        ],
    },
    {
        id: 'sec-03',
        title: 'Certifications and insurance',
        codes: ['M-03', 'M-04', 'M-05', 'M-10', 'M-11', 'S-04'],
        status: 'in_review',
        assignee: 'Kemi Adebayo',
        wordLimit: 800,
        body: 'We hold Cyber Essentials Plus, ISO/IEC 27001 and ISO 9001 certification, all issued by UKAS-accredited bodies. Our insurance includes £10m employer’s liability and £2m professional indemnity cover.',
        warnings: [
            {
                id: 'w-03-1',
                excerpt: 'We hold Cyber Essentials Plus',
                message: 'The Cyber Essentials Plus certificate on file expired on 31 Oct 2026.',
                severity: 'error',
            },
        ],
    },
    {
        id: 'sec-04',
        title: 'Relevant experience and case studies',
        codes: ['S-01'],
        status: 'drafting',
        assignee: 'Emma Richardson',
        wordLimit: 1500,
        body: 'Bluewave delivered a 1,400-node LAN and Wi-Fi refresh for Riverside NHS Foundation Trust’s head office in 2024. We have delivered 20+ public sector projects across the North of England with a team of 35 certified network engineers.',
        warnings: [
            {
                id: 'w-04-1',
                excerpt: 'We have delivered 20+ public sector projects',
                message: 'No profile fact supports “20+ public sector projects”. Add evidence or soften the claim.',
                severity: 'warning',
            },
        ],
    },
    {
        id: 'sec-05',
        title: 'Key personnel',
        codes: ['S-02'],
        status: 'complete',
        assignee: 'Emma Richardson',
        wordLimit: 1000,
        body: 'The project will be led by Sarah Whitfield (PRINCE2 Practitioner, 9 years), with Daniel Okoro (CCIE #61840, SC cleared) as lead network engineer, supported by our 38 engineers.',
    },
    {
        id: 'sec-06',
        title: 'Technical approach and methodology',
        codes: ['S-03'],
        status: 'not_started',
        assignee: 'Daniel Okoro',
        wordLimit: 6000,
        body: '',
    },
    {
        id: 'sec-07',
        title: 'Social value',
        codes: ['S-05'],
        status: 'drafting',
        assignee: 'Grace Lee',
        wordLimit: 1000,
        body: 'Since we were founded in 2014, local hiring has been central to how we work. Over the contract we will create two apprenticeships for Northshire residents and spend at least 60% of our supply chain budget with local SMEs.',
    },
    {
        id: 'sec-08',
        title: 'Form of tender and declarations',
        codes: ['I-02'],
        status: 'not_started',
        assignee: 'James Oliver',
        body: '',
    },
];

export function bidSectionsFor(tenderId: string): BidSection[] {
    const byCode = Object.fromEntries(eligibilityRowsFor(tenderId).map((r) => [r.requirement.code, r.requirement.id]));
    return seeds.map(({ codes, warnings, ...s }) => ({
        ...s,
        requirementIds: codes.map((c) => byCode[c]).filter(Boolean),
        citations: [],
        warnings: warnings ?? [],
    }));
}

/**
 * Canned "Draft with EBIS" output for the preview. The real engine will
 * write from the tender clauses and the company's evidence vault.
 */
const drafts: Record<string, string> = {
    'sec-06':
        'Our approach is built around a phased roll-out that keeps every council site running throughout. ' +
        'Phase 1 (weeks 1–4) is a full survey of the 12 sites, confirming cabling routes, comms rooms and power, and agreeing a cut-over plan with each site manager. ' +
        'Phase 2 (weeks 5–14) installs the new core and distribution switching at the two data centres, then migrates sites two at a time out of hours, with a tested roll-back plan for each move. ' +
        'Phase 3 (weeks 15–18) brings the new Wi-Fi and the network operations centre live, followed by 30 days of hypercare. ' +
        'Delivery is led by Sarah Whitfield [Project manager] with Daniel Okoro [Lead network engineer] as design authority. ' +
        'Risks are tracked in a shared register reviewed weekly with the Council; the top three at contract start are site access, equipment lead times and change freezes during elections.',
    'sec-08':
        'We confirm that this tender is submitted in accordance with the Invitation to Tender and that the prices quoted remain valid for 90 days from the deadline. ' +
        'We confirm that none of the mandatory or discretionary exclusion grounds in the Procurement Act 2023 apply to Bluewave Networks Ltd or its connected persons.',
};

export function draftFor(section: BidSection): string {
    return (
        drafts[section.id] ??
        `${section.title}: Bluewave Networks Ltd will meet this requirement in full. ` +
            'The evidence referenced below is held in our company vault and can be provided to the Council on request.'
    );
}
