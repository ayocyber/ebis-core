import { computeStats } from '@/components/eligibility/eligibility-summary';
import type { EligibilityRow, Gap, Money, Tender } from '@/types/ebis';

/** Days kept free before the deadline for final review and sign-off. */
export const REVIEW_BUFFER_DAYS = 2;

/** Weekdays from `from` (exclusive) up to `to` (inclusive). Bank holidays ignored. */
export function workingDaysBetween(from: Date, to: Date): number {
    if (to <= from) return 0;
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);
    let n = 0;
    while (d < end) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day !== 0 && day !== 6) n++;
    }
    return n;
}

/** The date reached after adding `days` working days to `from`. */
export function addWorkingDays(from: Date, days: number): Date {
    const d = new Date(from);
    let left = days;
    while (left > 0) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day !== 0 && day !== 6) left--;
    }
    return d;
}

export type GapTiming = 'done' | 'on_track' | 'tight' | 'late';

export const timingMeta: Record<GapTiming, { label: string; className: string }> = {
    done: { label: 'Closed', className: 'text-status-met' },
    on_track: { label: 'On track', className: 'text-status-met' },
    tight: { label: 'Tight', className: 'text-status-partial' },
    late: { label: 'Won’t make it', className: 'text-status-not-met' },
};

/** Will this gap close before the review buffer starts? */
export function gapTiming(gap: Gap, workingDaysLeft: number): { timing: GapTiming; slack: number } {
    const slack = workingDaysLeft - REVIEW_BUFFER_DAYS - gap.timeToCloseDays;
    if (gap.status === 'closed') return { timing: 'done', slack };
    if (slack < 0) return { timing: 'late', slack };
    if (slack <= 2) return { timing: 'tight', slack };
    return { timing: 'on_track', slack };
}

export function sumMoney(items: (Money | undefined)[]): Money {
    return { amount: items.reduce((t, m) => t + (m?.amount ?? 0), 0), currency: items.find(Boolean)?.currency ?? 'GBP' };
}

/* ------------------------------------------------------------------ */
/* Go / No-Go recommendation                                           */
/* ------------------------------------------------------------------ */

export type Verdict = 'go' | 'conditional' | 'no_go';
export type FactorTone = 'good' | 'warn' | 'bad';

export interface Factor {
    id: string;
    label: string;
    value: string;
    detail: string;
    tone: FactorTone;
}

export interface Recommendation {
    verdict: Verdict;
    headline: string;
    rationale: string;
    factors: Factor[];
    /** Open gaps that can't be closed before the deadline (GAP-02) */
    openBlockers: EligibilityRow[];
    /** Blockers on mandatory requirements: these fail the bid at selection */
    lateBlockers: EligibilityRow[];
    /** Open mandatory gaps that can still close in time: each becomes a condition of a Go */
    conditions: EligibilityRow[];
    workingDaysLeft: number;
    costToClose: Money;
}

export const verdictMeta: Record<Verdict, { label: string; short: string }> = {
    go: { label: 'Go', short: 'Go' },
    conditional: { label: 'Go with conditions', short: 'Conditional go' },
    no_go: { label: 'No-Go', short: 'No-Go' },
};

export function recommend(rows: EligibilityRow[], tender: Tender, now: Date = new Date()): Recommendation {
    const stats = computeStats(rows);
    const workingDaysLeft = workingDaysBetween(now, new Date(tender.deadline));

    const open = rows.filter((r) => r.gap && r.gap.status !== 'closed');
    const openBlockers = open.filter((r) => r.gap!.severity === 'blocker');
    const lateBlockers = openBlockers.filter((r) => r.requirement.category === 'mandatory');
    const conditions = open.filter((r) => r.requirement.category === 'mandatory' && r.gap!.severity !== 'blocker');
    const mandatoryOpen = [...lateBlockers, ...conditions];
    const longest = mandatoryOpen.reduce((m, r) => Math.max(m, r.gap!.timeToCloseDays), 0);
    const costToClose = sumMoney(open.map((r) => r.gap!.cost));

    const mandatoryUnknown = stats.mandatory.byStatus.unknown;
    const scoredPct = stats.scoredWeight.total ? Math.round((stats.scoredWeight.secured / stats.scoredWeight.total) * 100) : 0;
    const usable = workingDaysLeft - REVIEW_BUFFER_DAYS;

    const factors: Factor[] = [
        {
            id: 'mandatory',
            label: 'Mandatory requirements',
            value: `${stats.mandatory.byStatus.met} of ${stats.mandatory.total} met`,
            detail: lateBlockers.length
                ? `${lateBlockers.length} can’t be fixed before the deadline and would fail the bid at selection stage.`
                : conditions.length
                  ? `${conditions.length} still open, but each can be fixed before the deadline.`
                  : 'Nothing open on mandatory requirements.',
            tone: lateBlockers.length ? 'bad' : conditions.length ? 'warn' : 'good',
        },
        {
            id: 'timeline',
            label: 'Time to fix mandatory gaps',
            value: mandatoryOpen.length ? `${longest} of ${usable} days` : 'Nothing to fix',
            detail: mandatoryOpen.length
                ? `The slowest fix takes ${longest} working days. You have ${usable} before final review.`
                : `${workingDaysLeft} working days to the deadline.`,
            tone: lateBlockers.length ? 'bad' : usable - longest <= 2 && mandatoryOpen.length ? 'warn' : 'good',
        },
        {
            id: 'scored',
            label: 'Quality points secured',
            value: `${scoredPct}%`,
            detail: `${stats.scoredWeight.secured} of ${stats.scoredWeight.total} weighted points are backed by evidence today.`,
            tone: scoredPct >= 70 ? 'good' : scoredPct >= 50 ? 'warn' : 'bad',
        },
        {
            id: 'unknowns',
            label: 'Unconfirmed mandatory items',
            value: String(mandatoryUnknown),
            detail: mandatoryUnknown ? 'Evidence is missing — these could still go either way.' : 'Every mandatory item has evidence.',
            tone: mandatoryUnknown === 0 ? 'good' : mandatoryUnknown <= 2 ? 'warn' : 'bad',
        },
        {
            id: 'cost',
            label: 'Cost to close gaps',
            value: new Intl.NumberFormat('en-GB', { style: 'currency', currency: costToClose.currency, maximumFractionDigits: 0 }).format(
                costToClose.amount,
            ),
            detail: `Out-of-pocket estimate across ${open.length} open gap${open.length === 1 ? '' : 's'}, excluding staff time.`,
            tone: tender.estimatedValue && costToClose.amount > tender.estimatedValue.amount * 0.01 ? 'warn' : 'good',
        },
    ];

    let verdict: Verdict;
    let headline: string;
    let rationale: string;

    if (lateBlockers.length) {
        verdict = 'no_go';
        headline = 'Not winnable in the time left';
        rationale = `${lateBlockers.length} mandatory gap${lateBlockers.length > 1 ? 's' : ''} can’t be closed before the deadline. Bidding now would mean a bid that fails at selection stage.`;
    } else if (conditions.length) {
        verdict = 'conditional';
        headline = 'Bid — if the open gaps close on time';
        rationale = `You can be eligible, but only if ${conditions.length} mandatory gap${conditions.length > 1 ? 's close' : ' closes'} in the next ${usable} working days. Each one becomes a condition with an owner and a date.`;
    } else {
        verdict = 'go';
        headline = 'Clear to bid';
        rationale = 'Every mandatory requirement is met or covered. Move on to the compliance matrix.';
    }

    return { verdict, headline, rationale, factors, openBlockers, lateBlockers, conditions, workingDaysLeft, costToClose };
}
