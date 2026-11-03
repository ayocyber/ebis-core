import type { QuarterResult } from '@/data/mock-dashboard';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const H = 140;
const BAR = 14;
const GAP = 2;

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 });

/** Won vs lost bids per quarter: paired thin bars, legend, per-quarter hover tooltip, table for screen readers. */
export function ResultsChart({ data }: { data: QuarterResult[] }) {
    const [hover, setHover] = useState<number | null>(null);
    const max = Math.max(1, ...data.flatMap((d) => [d.won, d.lost]));
    const ticks = Array.from({ length: max + 1 }, (_, i) => i).filter((v) => max <= 4 || v % 2 === 0);

    return (
        <div>
            <div className="text-muted-foreground mb-3 flex items-center gap-4 text-xs" aria-hidden>
                <span className="flex items-center gap-1.5">
                    <span className="bg-primary size-2.5 rounded-sm" /> Won
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="bg-muted-foreground/35 size-2.5 rounded-sm" /> Lost
                </span>
            </div>

            <div className="relative flex gap-3" aria-hidden>
                {/* y axis */}
                <div className="text-muted-foreground relative w-4 shrink-0 text-[10px] tabular-nums" style={{ height: H }}>
                    {ticks.map((v) => (
                        <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: H - (v / max) * H }}>
                            {v}
                        </span>
                    ))}
                </div>

                <div className="relative flex-1">
                    {/* grid */}
                    {ticks.map((v) => (
                        <div
                            key={v}
                            className={cn('absolute inset-x-0 border-t', v === 0 ? 'border-border' : 'border-border/50 border-dashed')}
                            style={{ top: H - (v / max) * H }}
                        />
                    ))}

                    <div className="relative grid" style={{ height: H, gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
                        {data.map((d, i) => (
                            <div
                                key={d.quarter}
                                className={cn('relative flex items-end justify-center rounded-md transition-colors', hover === i && 'bg-muted/60')}
                                onMouseEnter={() => setHover(i)}
                                onMouseLeave={() => setHover(null)}
                                style={{ gap: GAP }}
                            >
                                <div className="bg-primary rounded-t-[4px]" style={{ width: BAR, height: Math.max(2, (d.won / max) * H) }} />
                                <div
                                    className="bg-muted-foreground/35 rounded-t-[4px]"
                                    style={{ width: BAR, height: Math.max(2, (d.lost / max) * H) }}
                                />

                                {hover === i && (
                                    <div className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-40 -translate-x-1/2 rounded-lg border p-2.5 text-xs shadow-lg">
                                        <p className="mb-1.5 font-semibold">{d.quarter}</p>
                                        <Row swatch="bg-primary" label="Won" value={String(d.won)} />
                                        <Row swatch="bg-muted-foreground/35" label="Lost" value={String(d.lost)} />
                                        <div className="mt-1.5 border-t pt-1.5">
                                            <Row label="Value won" value={gbp.format(d.wonValue)} />
                                            <Row label="Win rate" value={`${Math.round((d.won / Math.max(1, d.won + d.lost)) * 100)}%`} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div
                        className="text-muted-foreground mt-2 grid text-center text-[11px]"
                        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
                    >
                        {data.map((d) => (
                            <span key={d.quarter}>{d.quarter}</span>
                        ))}
                    </div>
                </div>
            </div>

            <table className="sr-only">
                <caption>Bids won and lost by quarter</caption>
                <thead>
                    <tr>
                        <th>Quarter</th>
                        <th>Won</th>
                        <th>Lost</th>
                        <th>Value won</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((d) => (
                        <tr key={d.quarter}>
                            <td>{d.quarter}</td>
                            <td>{d.won}</td>
                            <td>{d.lost}</td>
                            <td>{gbp.format(d.wonValue)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Row({ swatch, label, value }: { swatch?: string; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground flex items-center gap-1.5">
                {swatch && <span className={cn('size-2 rounded-sm', swatch)} />}
                {label}
            </span>
            <span className="font-medium tabular-nums">{value}</span>
        </div>
    );
}
