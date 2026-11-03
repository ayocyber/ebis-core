import type { AssessmentStatus, GapSeverity, Money, ProfileFactSource, RequirementCategory, RequirementTopic, TenderStage } from '@/types/ebis';
import { AlertCircle, CheckCircle2, CircleDashed, CircleHelp, type LucideIcon, MinusCircle, XCircle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Assessment status                                                   */
/* ------------------------------------------------------------------ */

export interface StatusMeta {
    label: string;
    icon: LucideIcon;
    /** Pill classes: tinted background, readable text, subtle ring */
    pill: string;
    /** Solid swatch for bars/dots */
    dot: string;
    text: string;
}

export const statusMeta: Record<AssessmentStatus, StatusMeta> = {
    met: {
        label: 'Met',
        icon: CheckCircle2,
        pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25',
        dot: 'bg-status-met',
        text: 'text-status-met',
    },
    partially_met: {
        label: 'Partially met',
        icon: MinusCircle,
        pill: 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25',
        dot: 'bg-status-partial',
        text: 'text-status-partial',
    },
    not_met: {
        label: 'Not met',
        icon: XCircle,
        pill: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/25',
        dot: 'bg-status-not-met',
        text: 'text-status-not-met',
    },
    unknown: {
        label: 'Unknown',
        icon: CircleHelp,
        pill: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
        dot: 'bg-status-unknown',
        text: 'text-status-unknown',
    },
};

export const statusOrder: AssessmentStatus[] = ['met', 'partially_met', 'not_met', 'unknown'];

/* ------------------------------------------------------------------ */
/* Requirement category & topic                                        */
/* ------------------------------------------------------------------ */

export const categoryMeta: Record<RequirementCategory, { label: string; short: string; description: string; className: string }> = {
    mandatory: {
        label: 'Mandatory',
        short: 'M',
        description: 'Pass/fail — any “not met” disqualifies the bid',
        className: 'bg-primary/8 text-primary ring-primary/20 dark:bg-primary/15',
    },
    scored: {
        label: 'Scored',
        short: 'S',
        description: 'Weighted criteria that earn evaluation points',
        className: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/25',
    },
    informational: {
        label: 'Informational',
        short: 'I',
        description: 'Context and submission notes — no direct score',
        className: 'bg-muted text-muted-foreground ring-border',
    },
};

export const topicLabels: Record<RequirementTopic, string> = {
    legal: 'Legal & statutory',
    financial: 'Financial',
    technical: 'Technical',
    experience: 'Experience',
    certification: 'Certification',
    insurance: 'Insurance',
    personnel: 'Personnel',
    social_value: 'Social value',
    submission: 'Submission',
};

export const factSourceLabels: Record<ProfileFactSource, string> = {
    company_profile: 'Company profile',
    certificate: 'Certificate',
    financial_statement: 'Financial statement',
    case_study: 'Case study',
    cv: 'CV',
    policy: 'Policy',
};

/* ------------------------------------------------------------------ */
/* Gaps                                                                */
/* ------------------------------------------------------------------ */

export const severityMeta: Record<GapSeverity, { label: string; icon: LucideIcon; className: string; bar: string }> = {
    blocker: {
        label: 'Blocker',
        icon: AlertCircle,
        className: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/25',
        bar: 'bg-status-not-met',
    },
    fixable: {
        label: 'Fixable',
        icon: CircleDashed,
        className: 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25',
        bar: 'bg-status-partial',
    },
    minor: {
        label: 'Minor',
        icon: MinusCircle,
        className: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
        bar: 'bg-status-unknown',
    },
};

/* ------------------------------------------------------------------ */
/* Workflow stages                                                     */
/* ------------------------------------------------------------------ */

export const stages: { id: TenderStage; label: string; short: string }[] = [
    { id: 'intake', label: 'Intake', short: 'Intake' },
    { id: 'extraction', label: 'Extraction', short: 'Extract' },
    { id: 'requirements', label: 'Requirements', short: 'Reqs' },
    { id: 'eligibility', label: 'Eligibility', short: 'Eligibility' },
    { id: 'gaps', label: 'Gap analysis', short: 'Gaps' },
    { id: 'decision', label: 'Go / No-Go', short: 'Decision' },
    { id: 'compliance', label: 'Compliance', short: 'Compliance' },
    { id: 'drafting', label: 'Drafting', short: 'Drafting' },
    { id: 'validation', label: 'Validation', short: 'Validate' },
    { id: 'submitted', label: 'Sign-off', short: 'Sign-off' },
];

export function stageIndex(stage: TenderStage): number {
    return stages.findIndex((s) => s.id === stage);
}

/* ------------------------------------------------------------------ */
/* Formatters                                                          */
/* ------------------------------------------------------------------ */

export function formatMoney(money: Money | null, compact = true): string {
    if (!money) return '—';
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: money.currency,
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 2 : 0,
    }).format(money.amount);
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
    return new Intl.DateTimeFormat('en-GB', opts).format(new Date(iso));
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function daysUntil(iso: string, now: Date = new Date()): number {
    return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

/** Tone for a deadline chip: red ≤ 7 days, amber ≤ 14 days. */
export function deadlineTone(days: number): 'urgent' | 'soon' | 'normal' | 'past' {
    if (days < 0) return 'past';
    if (days <= 7) return 'urgent';
    if (days <= 14) return 'soon';
    return 'normal';
}

export function deadlineLabel(days: number): string {
    if (days < 0) return 'Closed';
    if (days === 0) return 'Due today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
}

/** The page that best shows a tender at its current stage. */
export function stageRoute(stage: TenderStage): string {
    switch (stage) {
        case 'intake':
        case 'extraction':
        case 'requirements':
            return 'tenders.requirements';
        case 'gaps':
            return 'tenders.gaps';
        case 'decision':
            return 'tenders.decision';
        case 'compliance':
            return 'tenders.compliance';
        case 'drafting':
            return 'tenders.bid';
        case 'validation':
        case 'submitted':
            return 'tenders.validation';
        default:
            return 'tenders.eligibility';
    }
}
