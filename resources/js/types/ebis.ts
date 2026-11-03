/**
 * EBIS Core domain types.
 *
 * These mirror the shape the Laravel API/Inertia props will eventually send.
 * Dates are ISO-8601 strings; money is minor-unit free (whole currency units).
 */

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

export type ISODate = string;

export interface Money {
    amount: number;
    currency: 'GBP' | 'EUR' | 'USD';
}

/** The ten workflow stages from the EBIS Core spec. */
export type TenderStage =
    | 'intake' // 1. upload / import
    | 'extraction' // 2. parse documents & metadata
    | 'requirements' // 3. extract requirements
    | 'eligibility' // 4. assess against company profile
    | 'gaps' // 5. gap analysis
    | 'decision' // 6. go / no-go gate
    | 'compliance' // 7. compliance matrix
    | 'drafting' // 8. bid drafting
    | 'validation' // 9. validation & readiness
    | 'submitted'; // 10. sign-off & submission

/* ------------------------------------------------------------------ */
/* Tender (stages 1–2)                                                 */
/* ------------------------------------------------------------------ */

export type TenderDocumentKind = 'pdf' | 'docx' | 'zip' | 'xlsx';

export interface TenderDocument {
    id: string;
    name: string;
    kind: TenderDocumentKind;
    sizeBytes: number;
    pages?: number;
    /** e.g. "Invitation to tender", "Specification", "Pricing schedule" */
    role: string;
    uploadedAt: ISODate;
}

export interface Buyer {
    name: string;
    type: 'central' | 'local' | 'nhs' | 'education' | 'devolved' | 'private' | 'international';
    location: string;
}

export interface Tender {
    id: string;
    reference: string;
    title: string;
    summary: string;
    buyer: Buyer;
    source: { kind: 'upload' } | { kind: 'feed'; feed: string; url: string };
    publishedAt: ISODate;
    clarificationDeadline?: ISODate;
    deadline: ISODate;
    estimatedValue: Money | null;
    sector: string;
    lots?: number;
    stage: TenderStage;
    documents: TenderDocument[];
    /** 0-100, filled after stage 4 */
    eligibilityScore?: number;
    owner: { name: string; initials: string };
    createdAt: ISODate;
}

/* ------------------------------------------------------------------ */
/* Requirements (stage 3)                                              */
/* ------------------------------------------------------------------ */

export type RequirementCategory = 'mandatory' | 'scored' | 'informational';

export type RequirementTopic =
    | 'legal'
    | 'financial'
    | 'technical'
    | 'experience'
    | 'certification'
    | 'insurance'
    | 'personnel'
    | 'social_value'
    | 'submission';

/** Where a piece of text lives inside the tender pack. */
export interface SourceLocation {
    documentId: string;
    documentName: string;
    page: number;
    section?: string;
}

export interface Requirement {
    id: string;
    tenderId: string;
    /** Human-readable code shown in the matrix, e.g. "M-04" */
    code: string;
    title: string;
    /** Normalised requirement statement */
    text: string;
    category: RequirementCategory;
    topic: RequirementTopic;
    /** Percentage weight for scored requirements */
    weight?: number;
    source: SourceLocation & { quote: string };
}

/* ------------------------------------------------------------------ */
/* Company profile facts (the "evidence" side)                         */
/* ------------------------------------------------------------------ */

export type ProfileFactSource = 'company_profile' | 'certificate' | 'financial_statement' | 'case_study' | 'cv' | 'policy';

export interface ProfileFact {
    id: string;
    label: string;
    value: string;
    source: ProfileFactSource;
    documentName?: string;
    verifiedAt?: ISODate;
    expiresAt?: ISODate;
}

/* ------------------------------------------------------------------ */
/* Assessment & evidence (stage 4)                                     */
/* ------------------------------------------------------------------ */

export type AssessmentStatus = 'met' | 'partially_met' | 'not_met' | 'unknown';

export interface Evidence {
    id: string;
    requirementId: string;
    /** Exact words from the tender that the decision rests on */
    clauseQuote: string;
    /** Span inside clauseQuote to highlight (the decisive phrase) */
    highlight?: string;
    source: SourceLocation;
    profileFacts: ProfileFact[];
    /** Plain-language explanation of how the status was reached */
    reasoning: string;
}

export interface StatusOverride {
    previousStatus: AssessmentStatus;
    reason: string;
    by: string;
    at: ISODate;
}

export interface Assessment {
    id: string;
    requirementId: string;
    status: AssessmentStatus;
    /** 0-1 model confidence */
    confidence: number;
    summary: string;
    evidence: Evidence;
    assessedAt: ISODate;
    assessedBy: 'ebis-engine' | string;
    /** ELG-05: 'rule' for hard criteria, 'ai' for judgement calls (confidence applies) */
    method: 'rule' | 'ai';
    /** EVD-02: evidence that expires before the tender deadline */
    stale?: { factLabel: string; expiresAt: ISODate };
    reviewed: boolean;
    override?: StatusOverride;
}

/* ------------------------------------------------------------------ */
/* Gap analysis & decision (stages 5–6)                                */
/* ------------------------------------------------------------------ */

export type GapSeverity = 'blocker' | 'fixable' | 'minor';

export interface Gap {
    id: string;
    requirementId: string;
    severity: GapSeverity;
    title: string;
    description: string;
    remedy: string;
    /** Estimated working days to close */
    timeToCloseDays: number;
    status: 'open' | 'in_progress' | 'closed';
    owner?: string;
    /** Rough out-of-pocket cost to close */
    cost?: Money;
    /**
     * The document that closes this gap, if any. "company" documents are reused
     * across tenders and saved to the vault; "bid" documents belong to this tender only.
     */
    evidence?: { scope: 'company' | 'bid'; title: string; category: VaultCategory };
}

export type DecisionOutcome = 'proceed' | 'decline';

export interface GoNoGoDecision {
    outcome: DecisionOutcome;
    reason: string;
    acknowledgedBlockers: string[];
    /** Conditions attached to a Go, e.g. "PCG signed by 12 Nov" */
    conditions?: string[];
    decidedBy: string;
    decidedAt: ISODate;
}

/* ------------------------------------------------------------------ */
/* Bid (stages 7–10)                                                   */
/* ------------------------------------------------------------------ */

export interface Citation {
    id: string;
    profileFactId: string;
    /** Character offset into the section body */
    anchor: number;
}

export interface ClaimWarning {
    id: string;
    excerpt: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface BidSection {
    id: string;
    title: string;
    requirementIds: string[];
    body: string;
    wordLimit?: number;
    status: 'not_started' | 'drafting' | 'in_review' | 'complete';
    citations: Citation[];
    warnings: ClaimWarning[];
    assignee?: string;
}

export interface ReadinessIssue {
    id: string;
    sectionId?: string;
    requirementId?: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    message: string;
}

export interface Bid {
    id: string;
    tenderId: string;
    decision?: GoNoGoDecision;
    sections: BidSection[];
    /** 0-100 */
    readinessScore: number;
    issues: ReadinessIssue[];
    signedOff?: { by: string; at: ISODate };
}

/* ------------------------------------------------------------------ */
/* View models                                                         */
/* ------------------------------------------------------------------ */

/** A matrix row: a requirement joined with its assessment and any gap. */
export interface EligibilityRow {
    requirement: Requirement;
    assessment: Assessment;
    gap?: Gap;
}

/* ------------------------------------------------------------------ */
/* Evidence vault & company profile                                    */
/* ------------------------------------------------------------------ */

export type VaultCategory = 'company' | 'certificate' | 'insurance' | 'financial' | 'experience' | 'people' | 'policy' | 'other';

/** A file in the company's evidence vault. Profile facts are read from it. */
export interface VaultDocument {
    id: string;
    title: string;
    category: VaultCategory;
    fileName: string;
    kind: TenderDocumentKind;
    sizeBytes: number;
    issuer?: string;
    reference?: string;
    issuedAt?: ISODate;
    expiresAt?: ISODate;
    /** Short summary of what the document proves */
    summary: string;
    /** ProfileFact ids extracted from this document */
    factIds: string[];
    uploadedAt: ISODate;
    uploadedBy: string;
    /** Set when this document replaced an older version */
    replaces?: string;
}

/** Something a tender asked for that isn't in the vault. */
export interface MissingEvidence {
    id: string;
    title: string;
    category: VaultCategory;
    factId?: string;
    why: string;
}

export interface CompanyProfile {
    legalName: string;
    tradingName: string;
    companyNumber: string;
    incorporatedAt: ISODate;
    registeredOffice: string;
    vatNumber: string;
    cdpId: string;
    website: string;
    sector: string;
    employees: number;
    engineers: number;
    turnover: { year: string; amount: number }[];
    auditor: string;
    insurance: { label: string; cover: number }[];
    socialValue: string[];
    about: string;
}

/* ------------------------------------------------------------------ */
/* Documents checklist (BID-02 / VAL-02)                               */
/* ------------------------------------------------------------------ */

/**
 * form     — a buyer form EBIS can pre-fill from the profile (BID-06)
 * company  — a standing document that comes from the evidence vault
 * bid      — a file that belongs to this tender only
 * response — the written answers, built in the bid editor
 */
export type ChecklistKind = 'form' | 'company' | 'bid' | 'response';

export interface ChecklistField {
    id: string;
    label: string;
    /** Value EBIS pre-fills from the company profile */
    prefill?: string;
    /** Where the pre-fill came from, shown to the user */
    from?: string;
    hint?: string;
}

export interface ChecklistItem {
    id: string;
    kind: ChecklistKind;
    title: string;
    why: string;
    /** Where the tender pack asks for it, e.g. "ITT §7.3 · Form 1" */
    source: string;
    /** "conditional" items only apply in some cases, e.g. when using subcontractors */
    need: 'required' | 'conditional';
    condition?: string;
    /** Accepted file extensions */
    formats: string[];
    /** Stem used in the buyer's naming rule */
    fileStem: string;
    signature?: boolean;
    fields?: ChecklistField[];
    /** company items: matches a vault document title */
    vaultMatch?: string;
    missingId?: string;
}

/** What the user has done to a checklist item so far. */
export interface ChecklistProgress {
    fileName?: string;
    sizeBytes?: number;
    uploadedAt?: ISODate;
    uploadedBy?: string;
    fields?: Record<string, string>;
    notApplicable?: boolean;
}
