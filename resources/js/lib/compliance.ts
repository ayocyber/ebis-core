import type { BidSection, EligibilityRow } from '@/types/ebis';
import { CircleCheck, CircleDashed, CircleDot, CircleX, Eye, type LucideIcon, PenLine } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Bid section status                                                  */
/* ------------------------------------------------------------------ */

export const sectionStatusMeta: Record<BidSection['status'], { label: string; icon: LucideIcon; className: string; dot: string }> = {
    not_started: { label: 'Not started', icon: CircleDashed, className: 'bg-muted text-muted-foreground ring-border', dot: 'bg-status-unknown' },
    drafting: {
        label: 'Drafting',
        icon: PenLine,
        className: 'bg-primary/8 text-primary ring-primary/20 dark:bg-primary/15',
        dot: 'bg-primary',
    },
    in_review: {
        label: 'In review',
        icon: Eye,
        className: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/25',
        dot: 'bg-violet-500',
    },
    complete: {
        label: 'Complete',
        icon: CircleCheck,
        className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25',
        dot: 'bg-status-met',
    },
};

/* ------------------------------------------------------------------ */
/* Compliance status of one requirement                                */
/* ------------------------------------------------------------------ */

export type ComplianceStatus = 'compliant' | 'in_progress' | 'at_risk' | 'unanswered';

export const complianceOrder: ComplianceStatus[] = ['compliant', 'in_progress', 'at_risk', 'unanswered'];

export const complianceMeta: Record<ComplianceStatus, { label: string; hint: string; icon: LucideIcon; pill: string; bar: string }> = {
    compliant: {
        label: 'Compliant',
        hint: 'Eligible, no open gaps, answered in a finished section',
        icon: CircleCheck,
        pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25',
        bar: 'bg-status-met',
    },
    in_progress: {
        label: 'In progress',
        hint: 'Answer is being written or reviewed',
        icon: CircleDot,
        pill: 'bg-primary/8 text-primary ring-primary/20 dark:bg-primary/15',
        bar: 'bg-primary',
    },
    at_risk: {
        label: 'At risk',
        hint: 'Not met, or an open blocker stands in the way',
        icon: CircleX,
        pill: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/25',
        bar: 'bg-status-not-met',
    },
    unanswered: {
        label: 'Unanswered',
        hint: 'Not mapped to a section, or the section isn’t started',
        icon: CircleDashed,
        pill: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
        bar: 'bg-status-unknown',
    },
};

export interface ComplianceRow extends EligibilityRow {
    section?: BidSection;
    compliance: ComplianceStatus;
}

export function complianceStatus(row: EligibilityRow, section?: BidSection): ComplianceStatus {
    if (!section || section.status === 'not_started') return 'unanswered';
    const openGap = row.gap && row.gap.status !== 'closed';
    // Risk belongs to the requirement itself; a bad claim elsewhere in the section only stops it being "done".
    if (row.assessment.status === 'not_met' || (openGap && row.gap!.severity === 'blocker')) return 'at_risk';
    const sectionClean = section.status === 'complete' && !section.warnings.some((w) => w.severity === 'error');
    if (sectionClean && !openGap) return 'compliant';
    return 'in_progress';
}

/** Join requirements to the section that answers them. `mapping` overrides the section's own list. */
export function buildComplianceRows(rows: EligibilityRow[], sections: BidSection[], mapping: Record<string, string | undefined>): ComplianceRow[] {
    return rows.map((row) => {
        const id = row.requirement.id;
        const sectionId = id in mapping ? mapping[id] : sections.find((s) => s.requirementIds.includes(id))?.id;
        const section = sections.find((s) => s.id === sectionId);
        return { ...row, section, compliance: complianceStatus(row, section) };
    });
}

/** Plain CSV of the matrix, opened directly by Excel. */
export function complianceCsv(rows: ComplianceRow[]): string {
    const header = ['Code', 'Requirement', 'Category', 'Weight %', 'Source', 'Eligibility', 'Answered in', 'Owner', 'Compliance'];
    const lines = rows.map((r) => [
        r.requirement.code,
        r.requirement.title,
        r.requirement.category,
        r.requirement.weight ?? '',
        `${r.requirement.source.documentName} p.${r.requirement.source.page} ${r.requirement.source.section ?? ''}`.trim(),
        r.assessment.status.replace('_', ' '),
        r.section?.title ?? 'Not mapped',
        r.section?.assignee ?? '',
        complianceMeta[r.compliance].label,
    ]);
    return [header, ...lines].map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
