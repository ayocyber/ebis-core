import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { addWorkingDays, gapTiming, REVIEW_BUFFER_DAYS, timingMeta } from '@/lib/decision';
import { severityMeta } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import type { EligibilityRow, GapSeverity } from '@/types/ebis';
import { Check } from 'lucide-react';

const shortDate = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
const severities: GapSeverity[] = ['blocker', 'fixable', 'minor'];

/**
 * "Can we close in time?" — each gap as a bar from today, measured in working
 * days, against the review buffer and the submission deadline.
 */
export function GapTimeline({ rows, workingDaysLeft, deadline }: { rows: EligibilityRow[]; workingDaysLeft: number; deadline: string }) {
    const today = new Date();
    const longest = rows.reduce((m, r) => Math.max(m, r.gap!.timeToCloseDays), 0);
    const domain = Math.max(workingDaysLeft, longest) + 1;
    const pct = (days: number) => `${(days / domain) * 100}%`;
    const reviewStart = Math.max(0, workingDaysLeft - REVIEW_BUFFER_DAYS);

    const step = domain > 20 ? 5 : domain > 10 ? 3 : 2;
    const ticks = Array.from({ length: Math.floor(domain / step) + 1 }, (_, i) => i * step).filter((t) => t < domain);

    const sorted = [...rows].sort(
        (a, b) => severities.indexOf(a.gap!.severity) - severities.indexOf(b.gap!.severity) || b.gap!.timeToCloseDays - a.gap!.timeToCloseDays,
    );

    return (
        <TooltipProvider delayDuration={80}>
            <div className="space-y-4">
                <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" aria-label="Legend">
                    {severities.map((s) => (
                        <li key={s} className="flex items-center gap-1.5">
                            <span className={cn('h-2 w-4 rounded-full', severityMeta[s].bar)} />
                            {severityMeta[s].label}
                        </li>
                    ))}
                    <li className="flex items-center gap-1.5">
                        <span className="bg-muted-foreground/15 h-2 w-4 rounded-sm" />
                        Final review
                    </li>
                </ul>

                <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_5.5rem]">
                    {/* Track header: today / deadline */}
                    <div />
                    <div className="relative h-6">
                        <span className="text-muted-foreground absolute left-0 text-[11px] font-medium">Today</span>
                        <span
                            className="text-brand-accent absolute -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap"
                            style={{ left: pct(workingDaysLeft) }}
                        >
                            Deadline · {shortDate(new Date(deadline))}
                        </span>
                    </div>
                    <div className="hidden sm:block" />

                    {sorted.map((row) => {
                        const gap = row.gap!;
                        const { timing, slack } = gapTiming(gap, workingDaysLeft);
                        const done = addWorkingDays(today, gap.timeToCloseDays);
                        const closed = gap.status === 'closed';

                        return (
                            <div key={gap.id} className="contents">
                                <div className="flex min-w-0 items-center gap-2 py-2">
                                    <span className="text-muted-foreground font-mono text-[11px]">{row.requirement.code}</span>
                                    <span className={cn('truncate text-sm', closed && 'text-muted-foreground line-through')}>{gap.title}</span>
                                </div>

                                <div className="relative flex items-center">
                                    {/* review buffer + deadline */}
                                    <div
                                        aria-hidden
                                        className="bg-muted-foreground/10 absolute inset-y-0"
                                        style={{ left: pct(reviewStart), width: pct(workingDaysLeft - reviewStart) }}
                                    />
                                    <div aria-hidden className="bg-brand-accent/70 absolute inset-y-0 w-px" style={{ left: pct(workingDaysLeft) }} />
                                    {ticks.map((t) => (
                                        <div key={t} aria-hidden className="bg-border/60 absolute inset-y-0 w-px" style={{ left: pct(t) }} />
                                    ))}

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className="group relative z-10 flex h-6 items-center"
                                                style={{ width: pct(Math.max(gap.timeToCloseDays, 0.6)) }}
                                                aria-label={`${gap.title}: ${gap.timeToCloseDays} working days, ${timingMeta[timing].label}`}
                                            >
                                                <span
                                                    className={cn(
                                                        'h-2 w-full rounded-full transition-[height] group-hover:h-2.5',
                                                        severityMeta[gap.severity].bar,
                                                        closed && 'opacity-30',
                                                        timing === 'late' && 'ring-background ring-2',
                                                    )}
                                                />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-64">
                                            <p className="font-medium">{gap.title}</p>
                                            <p className="opacity-80">
                                                {gap.timeToCloseDays} working days · done by {shortDate(done)}
                                                {!closed && (slack >= 0 ? ` · ${slack} days to spare` : ` · ${-slack} days too late`)}
                                            </p>
                                            {gap.owner && <p className="opacity-80">Owner: {gap.owner}</p>}
                                        </TooltipContent>
                                    </Tooltip>
                                </div>

                                <div
                                    className={cn('hidden items-center justify-end gap-1 text-xs font-medium sm:flex', timingMeta[timing].className)}
                                >
                                    {closed && <Check className="size-3.5" />}
                                    {timingMeta[timing].label}
                                </div>
                            </div>
                        );
                    })}

                    {/* Axis */}
                    <div />
                    <div className="relative mt-1 h-5 border-t">
                        {ticks.map((t) => (
                            <span
                                key={t}
                                className="text-muted-foreground absolute top-1 -translate-x-1/2 text-[10px] whitespace-nowrap tabular-nums first:translate-x-0"
                                style={{ left: pct(t) }}
                            >
                                {t === 0 ? 'Now' : shortDate(addWorkingDays(today, t))}
                            </span>
                        ))}
                    </div>
                    <div className="hidden sm:block" />
                </div>
                <p className="text-muted-foreground text-xs">
                    Working days, weekends excluded. The last {REVIEW_BUFFER_DAYS} days are kept for final review.
                </p>
            </div>
        </TooltipProvider>
    );
}
