import { SeverityBadge } from '@/components/ebis/badges';
import { Button } from '@/components/ui/button';
import { addWorkingDays, gapTiming, timingMeta } from '@/lib/decision';
import { cn } from '@/lib/utils';
import type { EligibilityRow, Gap } from '@/types/ebis';
import { CalendarClock, Check, CircleDot, FolderLock, Lightbulb, Loader, Paperclip, PoundSterling, UploadCloud } from 'lucide-react';

const statusOptions: { value: Gap['status']; label: string; icon: typeof Check }[] = [
    { value: 'open', label: 'Open', icon: CircleDot },
    { value: 'in_progress', label: 'In progress', icon: Loader },
    { value: 'closed', label: 'Closed', icon: Check },
];

function initials(owner: string) {
    const name = owner.includes('—') ? owner.split('—')[1] : owner;
    return name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

const money = (amount: number) =>
    amount === 0 ? 'No cost' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);

export function GapCard({
    row,
    workingDaysLeft,
    canEdit,
    onStatusChange,
    onUpload,
    style,
}: {
    row: EligibilityRow;
    workingDaysLeft: number;
    canEdit: boolean;
    onStatusChange: (status: Gap['status']) => void;
    /** Opens the upload dialog for the document that closes this gap */
    onUpload?: () => void;
    style?: React.CSSProperties;
}) {
    const gap = row.gap!;
    const { timing } = gapTiming(gap, workingDaysLeft);
    const closed = gap.status === 'closed';
    const dueBy = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(addWorkingDays(new Date(), gap.timeToCloseDays));

    return (
        <article
            style={style}
            className={cn(
                'bg-card animate-fade-up group relative overflow-hidden rounded-xl border transition-all',
                closed ? 'opacity-70' : 'hover:border-primary/25 hover:shadow-[0_8px_30px_-16px_var(--glow)]',
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'absolute inset-y-0 left-0 w-1',
                    closed
                        ? 'bg-status-met'
                        : gap.severity === 'blocker'
                          ? 'bg-status-not-met'
                          : gap.severity === 'fixable'
                            ? 'bg-status-partial'
                            : 'bg-status-unknown',
                )}
            />

            <div className="flex flex-col gap-4 p-4 pl-5 sm:p-5 sm:pl-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                        <p className="text-muted-foreground flex items-center gap-2 text-xs">
                            <span className="font-mono">{row.requirement.code}</span>
                            <span aria-hidden>·</span>
                            <span className="truncate">{row.requirement.title}</span>
                        </p>
                        <h3 className={cn('font-semibold tracking-tight', closed && 'line-through decoration-1')}>{gap.title}</h3>
                        <p className="text-muted-foreground text-sm">{gap.description}</p>
                    </div>
                    <SeverityBadge severity={gap.severity} />
                </div>

                <div className="bg-muted/50 rounded-lg border p-3 text-sm leading-relaxed">
                    <div className="flex gap-2.5">
                        <Lightbulb className="text-primary mt-0.5 size-4 shrink-0" />
                        <p>
                            <span className="font-medium">How to close it. </span>
                            {gap.remedy}
                        </p>
                    </div>
                    {gap.evidence && !closed && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 pl-6.5">
                            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                {gap.evidence.scope === 'company' ? <FolderLock className="size-3.5" /> : <Paperclip className="size-3.5" />}
                                {gap.evidence.scope === 'company' ? 'Saved to your vault for future bids' : 'Kept with this bid only'}
                            </span>
                            {onUpload && canEdit && (
                                <Button size="sm" variant="outline" className="h-8" onClick={onUpload}>
                                    <UploadCloud className="size-4" /> Upload {gap.evidence.title.length > 28 ? 'document' : gap.evidence.title}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <dl className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                        {gap.owner && (
                            <div className="flex items-center gap-1.5">
                                <dt className="sr-only">Owner</dt>
                                <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-[10px] font-semibold">
                                    {initials(gap.owner)}
                                </span>
                                <dd className="text-foreground/80">{gap.owner}</dd>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <dt className="sr-only">Time to close</dt>
                            <CalendarClock className="size-3.5" />
                            <dd>
                                {gap.timeToCloseDays} working day{gap.timeToCloseDays === 1 ? '' : 's'}
                                {!closed && <> · by {dueBy}</>}
                            </dd>
                        </div>
                        {gap.cost && (
                            <div className="flex items-center gap-1.5">
                                <dt className="sr-only">Cost</dt>
                                <PoundSterling className="size-3.5" />
                                <dd>{money(gap.cost.amount)}</dd>
                            </div>
                        )}
                        {!closed && <dd className={cn('font-medium', timingMeta[timing].className)}>{timingMeta[timing].label}</dd>}
                    </dl>

                    <div role="radiogroup" aria-label={`Status of ${gap.title}`} className="bg-muted/60 inline-flex rounded-lg border p-0.5">
                        {statusOptions.map(({ value, label, icon: Icon }) => {
                            const active = gap.status === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    disabled={!canEdit}
                                    onClick={() => onStatusChange(value)}
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all disabled:cursor-not-allowed',
                                        active
                                            ? cn('bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10', value === 'closed' && 'text-status-met')
                                            : 'text-muted-foreground enabled:hover:text-foreground',
                                    )}
                                >
                                    <Icon className="size-3.5" />
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </article>
    );
}
