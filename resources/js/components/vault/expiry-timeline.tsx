import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { expiryLabel, expiryMeta, expiryState } from '@/lib/vault';
import type { VaultDocument } from '@/types/ebis';

const DAY = 86_400_000;
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short' });

/**
 * The next 12 months of renewals. Overdue items sit in a red zone on the left,
 * so nothing that has already lapsed falls off the chart.
 */
export function ExpiryTimeline({ documents, onOpen }: { documents: VaultDocument[]; onOpen: (id: string) => void }) {
    const now = new Date();
    const start = now.getTime();
    const end = start + 365 * DAY;
    const OVERDUE = 9; // % of width reserved for overdue items

    const items = documents
        .filter((d) => d.expiresAt && new Date(d.expiresAt).getTime() <= end)
        .map((d) => {
            const t = new Date(d.expiresAt!).getTime();
            const x = t < start ? OVERDUE / 2 : OVERDUE + ((t - start) / (end - start)) * (100 - OVERDUE);
            return { doc: d, x, ...expiryState(d, now) };
        })
        .sort((a, b) => a.x - b.x);

    // Stack markers into lanes so labels never collide.
    const laneEnds: number[] = [];
    const placed = items.map((it) => {
        let lane = laneEnds.findIndex((endX) => it.x - endX > 14);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = it.x;
        return { ...it, lane };
    });
    const lanes = Math.max(1, laneEnds.length);

    const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
        return { label: monthFmt.format(d), x: OVERDUE + ((d.getTime() - start) / (end - start)) * (100 - OVERDUE) };
    });

    return (
        <TooltipProvider delayDuration={60}>
            <div className="overflow-x-auto [scrollbar-width:thin]">
                <div className="relative min-w-[640px]" style={{ height: lanes * 34 + 44 }}>
                    {/* overdue zone */}
                    <div
                        className="bg-status-not-met/8 border-status-not-met/20 absolute inset-y-0 left-0 rounded-l-lg border-r border-dashed"
                        style={{ width: `${OVERDUE}%` }}
                    >
                        <span className="text-status-not-met absolute bottom-1 left-2 text-[10px] font-semibold">Overdue</span>
                    </div>
                    {/* 30 / 90 day bands */}
                    <div
                        className="bg-status-partial/6 absolute inset-y-0"
                        style={{ left: `${OVERDUE}%`, width: `${(30 / 365) * (100 - OVERDUE)}%` }}
                        aria-hidden
                    />
                    {/* month grid */}
                    {months.map((m) => (
                        <div key={m.label + m.x} className="absolute inset-y-0" style={{ left: `${m.x}%` }} aria-hidden>
                            <div className="bg-border/70 h-full w-px" />
                            <span className="text-muted-foreground absolute bottom-1 left-1 text-[10px]">{m.label}</span>
                        </div>
                    ))}
                    {/* today */}
                    <div className="absolute inset-y-0" style={{ left: `${OVERDUE}%` }} aria-hidden>
                        <div className="bg-foreground/60 h-full w-px" />
                        <span className="bg-foreground text-background absolute -top-0 left-1 rounded px-1 text-[10px] font-semibold">Today</span>
                    </div>

                    {placed.map(({ doc, x, lane, state, days }) => (
                        <Tooltip key={doc.id}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onOpen(doc.id)}
                                    className="group hover:bg-muted absolute flex max-w-[150px] -translate-x-[7px] items-center gap-1.5 rounded-full py-0.5 pr-2 pl-0.5 text-left transition-colors"
                                    style={{ left: `${x}%`, top: 22 + lane * 34 }}
                                >
                                    <span className={cn('ring-background size-3.5 shrink-0 rounded-full ring-2', expiryMeta[state].dot)} />
                                    <span className="truncate text-xs font-medium">{doc.title}</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="font-medium">{doc.title}</p>
                                <p className="opacity-80">{expiryLabel(days)}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}

                    {placed.length === 0 && (
                        <p className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
                            Nothing expires in the next 12 months.
                        </p>
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
}
