/**
 * Eligibility and gap rules from the spec, kept in one place so the mock data,
 * the tender pages and (later) the backend tests all agree.
 *
 * ELG-01 / ELG-05  hard criteria are checked by rules; judgement calls by AI with a confidence score
 * ELG-04           overall verdict: any mandatory "Not met" prevents "Qualifies"
 * EVD-02           evidence expiring before the deadline is stale → "Partially met"
 * GAP-02           blocker = cannot realistically be closed before the deadline
 */
import { REVIEW_BUFFER_DAYS } from '@/lib/decision';
import type { EligibilityRow, GapSeverity, ProfileFact, RequirementCategory, RequirementTopic } from '@/types/ebis';

/* ELG-01 / ELG-05 -------------------------------------------------- */

const ruleTopics: RequirementTopic[] = ['legal', 'financial', 'certification', 'insurance'];

export type AssessmentMethod = 'rule' | 'ai';

export function assessmentMethod(topic: RequirementTopic): AssessmentMethod {
    return ruleTopics.includes(topic) ? 'rule' : 'ai';
}

/** AI results below this confidence go to the user for review. */
export const AI_REVIEW_THRESHOLD = 0.6;

export const methodMeta: Record<AssessmentMethod, { label: string; hint: string }> = {
    rule: { label: 'Rule', hint: 'Checked by a fixed rule. The same inputs always give the same result.' },
    ai: { label: 'AI', hint: 'A judgement call made by AI. Check it, especially when confidence is low.' },
};

export function needsReview(method: AssessmentMethod, confidence: number, reviewed: boolean): boolean {
    return method === 'ai' && confidence < AI_REVIEW_THRESHOLD && !reviewed;
}

/* EVD-02 ----------------------------------------------------------- */

/** The first fact that expires before the deadline, if any. */
export function staleFact(facts: ProfileFact[], deadline: Date): ProfileFact | undefined {
    return facts.filter((f) => f.expiresAt && new Date(f.expiresAt) < deadline).sort((a, b) => +new Date(a.expiresAt!) - +new Date(b.expiresAt!))[0];
}

/* GAP-02 ----------------------------------------------------------- */

/**
 * blocker  — the fix takes longer than the working days left (minus the review buffer)
 * fixable  — a mandatory requirement that can be closed in time
 * minor    — a scored or informational point that can be closed in time
 */
export function classifyGap(timeToCloseDays: number, category: RequirementCategory, workingDaysLeft: number): GapSeverity {
    if (timeToCloseDays > Math.max(0, workingDaysLeft - REVIEW_BUFFER_DAYS)) return 'blocker';
    return category === 'mandatory' ? 'fixable' : 'minor';
}

/* ELG-04 ----------------------------------------------------------- */

export type Qualification = 'qualifies' | 'conditional' | 'does_not_qualify';

export const qualificationMeta: Record<Qualification, { label: string; hint: string; tone: 'met' | 'partial' | 'not-met' }> = {
    qualifies: { label: 'Qualifies', hint: 'Every mandatory requirement is met.', tone: 'met' },
    conditional: {
        label: 'Not confirmed yet',
        hint: 'No mandatory requirement fails, but some are only partly met or have no evidence yet.',
        tone: 'partial',
    },
    does_not_qualify: {
        label: 'Does not qualify yet',
        hint: 'At least one mandatory requirement is not met. Close it before you can qualify.',
        tone: 'not-met',
    },
};

export function overallVerdict(rows: EligibilityRow[]): { verdict: Qualification; notMet: number; open: number } {
    // A closed gap means the evidence now exists, so the requirement counts as met.
    const mandatory = rows
        .filter((r) => r.requirement.category === 'mandatory')
        .map((r) => (r.gap?.status === 'closed' ? 'met' : r.assessment.status));
    const notMet = mandatory.filter((s) => s === 'not_met').length;
    const open = mandatory.filter((s) => s === 'partially_met' || s === 'unknown').length;
    return { verdict: notMet ? 'does_not_qualify' : open ? 'conditional' : 'qualifies', notMet, open };
}
