import { statusMeta, statusOrder } from '@/lib/ebis';
import { overallVerdict, qualificationMeta } from '@/lib/rules';
import { cn } from '@/lib/utils';
import type { AssessmentStatus, EligibilityRow } from '@/types/ebis';
import { AlertTriangle, BadgeCheck, CircleAlert, CircleHelp, ShieldCheck, ShieldX, Target } from 'lucide-react';
import { useMemo } from 'react';

export interface EligibilityStats {
    total: number;
    byStatus: Record<AssessmentStatus, number>;
    mandatory: { total: number; byStatus: Record<AssessmentStatus, number> };
    scoredWeight: { secured: number; atRisk: number; total: number };
    blockers: number;
    unreviewed: number;
    /** 0-100: mandatory met = 1, partial = 0.5 */
    score: number;
}

const emptyCounts = (): Record<AssessmentStatus, number> => ({ met: 0, partially_met: 0, not_met: 0, unknown: 0 });

export function computeStats(rows: EligibilityRow[]): EligibilityStats {
    const byStatus = emptyCounts();
    const mandatory = { total: 0, byStatus: emptyCounts() };
    const scoredWeight = { secured: 0, atRisk: 0, total: 0 };
    let blockers = 0;
    let unreviewed = 0;

    for (const { requirement, assessment, gap } of rows) {
        byStatus[assessment.status]++;
        if (!assessment.reviewed) unreviewed++;
        if (gap?.severity === 'blocker' && gap.status !== 'closed') blockers++;

        if (requirement.category === 'mandatory') {
            mandatory.total++;
            mandatory.byStatus[assessment.status]++;
        }
        if (requirement.category === 'scored' && requirement.weight) {
            scoredWeight.total += requirement.weight;
            if (assessment.status === 'met') scoredWeight.secured += requirement.weight;
            else if (assessment.status === 'partially_met') scoredWeight.secured += requirement.weight / 2;
            if (assessment.status !== 'met') scoredWeight.atRisk += requirement.weight;
        }
    }

    const score = mandatory.total ? Math.round(((mandatory.byStatus.met + mandatory.byStatus.partially_met * 0.5) / mandatory.total) * 100) : 0;

    return { total: rows.length, byStatus, mandatory, scoredWeight, blockers, unreviewed, score };
}

export type SummaryShortcut = 'mandatory-issues' | 'blockers' | 'unknown' | 'scored';

interface Props {
    rows: EligibilityRow[];
    active?: SummaryShortcut | null;
    onShortcut: (shortcut: SummaryShortcut) => void;
}

export function EligibilitySummary({ rows, active, onShortcut }: Props) {
    const stats = useMemo(() => computeStats(rows), [rows]);
    const mandatoryIssues = stats.mandatory.byStatus.not_met + stats.mandatory.byStatus.partially_met;

    const verdict = overallVerdict(rows);
    const vMeta = qualificationMeta[verdict.verdict];
    const VIcon = verdict.verdict === 'qualifies' ? BadgeCheck : verdict.verdict === 'conditional' ? CircleAlert : ShieldX;
    const vTone = {
        met: 'border-status-met/30 bg-status-met/[0.06] text-status-met',
        partial: 'border-status-partial/30 bg-status-partial/[0.06] text-status-partial',
        'not-met': 'border-status-not-met/30 bg-status-not-met/[0.06] text-status-not-met',
    }[vMeta.tone];

    return (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))]">
            {/* Overall verdict (ELG-04) */}
            <div
                className={cn('flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:gap-4 lg:col-span-4', vTone)}
                role="status"
            >
                <div className="flex items-center gap-2.5">
                    <VIcon className="size-5 shrink-0" />
                    <p className="text-foreground text-sm">
                        <span className="text-muted-foreground">Overall verdict: </span>
                        <span className="font-semibold">{vMeta.label}</span>
                    </p>
                </div>
                <p className="text-muted-foreground text-xs sm:ml-auto sm:text-right">
                    {verdict.verdict === 'qualifies'
                        ? vMeta.hint
                        : [
                              verdict.notMet ? `${verdict.notMet} mandatory requirement${verdict.notMet > 1 ? 's' : ''} not met` : '',
                              verdict.open ? `${verdict.open} still to confirm` : '',
                          ]
                              .filter(Boolean)
                              .join(' · ')}
                </p>
            </div>

            {/* Gauge + distribution */}
            <div className="bg-card flex items-center gap-5 rounded-xl border p-4 shadow-xs sm:col-span-2 lg:col-span-1">
                <ScoreGauge value={stats.score} />
                <div className="min-w-0 flex-1 space-y-3">
                    <div>
                        <p className="text-muted-foreground text-xs font-medium">Mandatory eligibility</p>
                        <p className="text-sm">
                            <span className="text-foreground font-semibold tabular-nums">{stats.mandatory.byStatus.met}</span>
                            <span className="text-muted-foreground"> of {stats.mandatory.total} fully met</span>
                        </p>
                    </div>
                    <DistributionBar counts={stats.byStatus} total={stats.total} />
                    <ul className="flex flex-wrap gap-x-3 gap-y-1">
                        {statusOrder.map((s) => (
                            <li key={s} className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                <span className={cn('size-2 rounded-full', statusMeta[s].dot)} />
                                {statusMeta[s].label}
                                <span className="text-foreground font-medium tabular-nums">{stats.byStatus[s]}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:contents">
                <KpiCard
                    icon={AlertTriangle}
                    tone="danger"
                    label="Blockers"
                    value={stats.blockers}
                    hint={stats.blockers ? 'Can’t be fixed before the deadline' : 'Everything can be fixed in time'}
                    active={active === 'blockers'}
                    onClick={() => onShortcut('blockers')}
                />
                <KpiCard
                    icon={ShieldCheck}
                    tone="warning"
                    label="Mandatory issues"
                    value={mandatoryIssues}
                    hint="Not met or partially met"
                    active={active === 'mandatory-issues'}
                    onClick={() => onShortcut('mandatory-issues')}
                />
                <KpiCard
                    icon={CircleHelp}
                    tone="neutral"
                    label="Needs your input"
                    value={stats.byStatus.unknown}
                    hint="Engine couldn't decide"
                    active={active === 'unknown'}
                    onClick={() => onShortcut('unknown')}
                    className="col-span-2 sm:col-span-1"
                />
            </div>

            <button
                type="button"
                onClick={() => onShortcut('scored')}
                className={cn(
                    'bg-card hover:border-primary/30 group flex items-center gap-4 rounded-xl border px-4 py-3 text-left shadow-xs transition-all hover:shadow-sm lg:col-span-4',
                    active === 'scored' && 'border-primary/40 ring-primary/15 ring-2',
                )}
            >
                <span className="bg-primary/8 text-primary dark:bg-primary/15 flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Target className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-sm font-medium">
                            Scored criteria — <span className="tabular-nums">{stats.scoredWeight.secured}</span>
                            <span className="text-muted-foreground font-normal"> of {stats.scoredWeight.total} weighted points evidenced</span>
                        </p>
                        <p className="text-muted-foreground text-xs">
                            <span className="text-foreground font-medium tabular-nums">{stats.scoredWeight.atRisk}</span> points need work
                        </p>
                    </div>
                    <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                        <div
                            className="bg-primary h-full rounded-full transition-[width] duration-700 ease-out"
                            style={{ width: `${stats.scoredWeight.total ? (stats.scoredWeight.secured / stats.scoredWeight.total) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            </button>
        </div>
    );
}

function KpiCard({
    icon: Icon,
    label,
    value,
    hint,
    tone,
    active,
    onClick,
    className,
}: {
    icon: typeof AlertTriangle;
    label: string;
    value: number;
    hint: string;
    tone: 'danger' | 'warning' | 'neutral';
    active?: boolean;
    onClick: () => void;
    className?: string;
}) {
    const toneClass = {
        danger: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
        warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
        neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300',
    }[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'bg-card hover:border-primary/30 group flex flex-col justify-between gap-3 rounded-xl border p-4 text-left shadow-xs transition-all hover:-translate-y-px hover:shadow-sm',
                active && 'border-primary/40 ring-primary/15 ring-2',
                className,
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs font-medium">{label}</span>
                <span className={cn('flex size-7 items-center justify-center rounded-lg', toneClass)}>
                    <Icon className="size-3.5" />
                </span>
            </div>
            <div>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{hint}</p>
            </div>
        </button>
    );
}

function DistributionBar({ counts, total }: { counts: Record<AssessmentStatus, number>; total: number }) {
    return (
        <div className="bg-muted flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {statusOrder.map((s) =>
                counts[s] ? (
                    <div
                        key={s}
                        className={cn(
                            'h-full transition-[flex-grow] duration-500 ease-out first:rounded-l-full last:rounded-r-full',
                            statusMeta[s].dot,
                        )}
                        style={{ flexGrow: counts[s], flexBasis: 0 }}
                        title={`${statusMeta[s].label}: ${counts[s]} of ${total}`}
                    />
                ) : null,
            )}
        </div>
    );
}

/** Semi-circular score gauge. */
export function ScoreGauge({ value, size = 104 }: { value: number; size?: number }) {
    const stroke = 9;
    const r = (size - stroke) / 2;
    const circumference = Math.PI * r;
    const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
    const tone = value >= 85 ? 'text-status-met' : value >= 60 ? 'text-status-partial' : 'text-status-not-met';
    const label = value >= 85 ? 'Strong' : value >= 60 ? 'At risk' : 'Weak';

    return (
        <div className="relative shrink-0" style={{ width: size, height: size / 2 + 18 }}>
            <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`} aria-hidden>
                <path
                    d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    className="text-muted"
                />
                <path
                    d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className={cn('transition-[stroke-dashoffset] duration-700 ease-out', tone)}
                />
            </svg>
            <div className="absolute inset-x-0 bottom-0 text-center" role="img" aria-label={`Eligibility score ${value} out of 100, ${label}`}>
                <p className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</p>
                <p className={cn('mt-0.5 text-[11px] font-medium', tone)}>{label}</p>
            </div>
        </div>
    );
}
