import { eligibilityRowsFor, tenders } from '@/data/mock-ebis';
import { daysUntil } from '@/lib/ebis';
import type { AssessmentStatus, Tender, VaultCategory, VaultDocument } from '@/types/ebis';
import { Award, Briefcase, Building2, FileBadge, FileText, Landmark, type LucideIcon, ScrollText, ShieldCheck, Users } from 'lucide-react';

export const vaultCategoryMeta: Record<VaultCategory, { label: string; plural: string; icon: LucideIcon }> = {
    company: { label: 'Company', plural: 'Company documents', icon: Building2 },
    certificate: { label: 'Certificate', plural: 'Certificates', icon: Award },
    insurance: { label: 'Insurance', plural: 'Insurance', icon: ShieldCheck },
    financial: { label: 'Financial', plural: 'Financial', icon: Landmark },
    experience: { label: 'Case study', plural: 'Case studies', icon: Briefcase },
    people: { label: 'CV', plural: 'People & CVs', icon: Users },
    policy: { label: 'Policy', plural: 'Policies', icon: ScrollText },
    other: { label: 'Other', plural: 'Other documents', icon: FileText },
};

export const vaultCategoryOrder: VaultCategory[] = ['company', 'certificate', 'insurance', 'financial', 'experience', 'people', 'policy', 'other'];

export const FallbackDocIcon = FileBadge;

/* ------------------------------------------------------------------ */
/* Expiry                                                              */
/* ------------------------------------------------------------------ */

export type ExpiryState = 'expired' | 'expiring' | 'renew_soon' | 'valid' | 'no_expiry';

export const expiryMeta: Record<ExpiryState, { label: string; pill: string; dot: string }> = {
    expired: {
        label: 'Expired',
        pill: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/25',
        dot: 'bg-status-not-met',
    },
    expiring: {
        label: 'Expires soon',
        pill: 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25',
        dot: 'bg-status-partial',
    },
    renew_soon: {
        label: 'Renew in 90 days',
        pill: 'bg-primary/8 text-primary ring-primary/20 dark:bg-primary/15',
        dot: 'bg-primary',
    },
    valid: {
        label: 'Valid',
        pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25',
        dot: 'bg-status-met',
    },
    no_expiry: { label: 'No expiry', pill: 'bg-muted text-muted-foreground ring-border', dot: 'bg-status-unknown' },
};

export function expiryState(doc: Pick<VaultDocument, 'expiresAt'>, now = new Date()): { state: ExpiryState; days: number | null } {
    if (!doc.expiresAt) return { state: 'no_expiry', days: null };
    const days = daysUntil(doc.expiresAt, now);
    if (days < 0) return { state: 'expired', days };
    if (days <= 30) return { state: 'expiring', days };
    if (days <= 90) return { state: 'renew_soon', days };
    return { state: 'valid', days };
}

export function expiryLabel(days: number | null): string {
    if (days === null) return 'Never expires';
    if (days < -1) return `Expired ${-days} days ago`;
    if (days === -1) return 'Expired yesterday';
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `Expires in ${days} days`;
}

/* ------------------------------------------------------------------ */
/* Where a document is used                                            */
/* ------------------------------------------------------------------ */

export interface DocUsage {
    tender: Tender;
    code: string;
    title: string;
    status: AssessmentStatus;
    gapId?: string;
}

/** Live tenders (eligibility done, not yet submitted) whose requirements rely on these facts. */
export function usageFor(factIds: string[]): DocUsage[] {
    if (!factIds.length) return [];
    const live = tenders.filter((t) => t.eligibilityScore !== undefined && t.stage !== 'submitted');
    return live.flatMap((tender) =>
        eligibilityRowsFor(tender.id)
            .filter((r) => r.assessment.evidence.profileFacts.some((f) => factIds.includes(f.id)))
            .map((r) => ({ tender, code: r.requirement.code, title: r.requirement.title, status: r.assessment.status, gapId: r.gap?.id })),
    );
}
