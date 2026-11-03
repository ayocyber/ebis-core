import { stageIndex, stages } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import type { TenderStage } from '@/types/ebis';
import { Check } from 'lucide-react';

/**
 * Horizontal progress through the 10-stage EBIS workflow.
 * Scrolls sideways on small screens instead of wrapping.
 */
export function StageStepper({ current, viewing }: { current: TenderStage; viewing?: TenderStage }) {
    const currentIdx = stageIndex(current);
    const viewingIdx = stageIndex(viewing ?? current);

    return (
        <nav aria-label="Bid workflow" className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            <ol className="flex min-w-max items-center gap-1">
                {stages.map((stage, i) => {
                    const done = i < currentIdx;
                    const active = i === viewingIdx;
                    const upcoming = i > currentIdx;
                    return (
                        <li key={stage.id} className="flex items-center gap-1">
                            <span
                                aria-current={active ? 'step' : undefined}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 text-xs font-medium transition-colors',
                                    active && 'bg-primary text-primary-foreground shadow-sm',
                                    !active && done && 'text-foreground',
                                    !active && upcoming && 'text-muted-foreground',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-5 items-center justify-center rounded-full text-[10px] tabular-nums',
                                        active && 'bg-primary-foreground/15',
                                        !active && done && 'bg-status-met/15 text-status-met',
                                        !active && upcoming && 'bg-muted',
                                    )}
                                >
                                    {done && !active ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                                </span>
                                {stage.label}
                            </span>
                            {i < stages.length - 1 && (
                                <span className={cn('h-px w-3', i < currentIdx ? 'bg-status-met/50' : 'bg-border')} aria-hidden />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
