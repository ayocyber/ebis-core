import { SiteLogo } from '@/components/marketing/site-header';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const steps = ['Company', 'Documents', 'First tender'] as const;

/** Sticky header for the first-run setup: logo, step tracker, theme toggle. `current` is 1-based; 0 hides the tracker. */
export function SetupHeader({ current }: { current: number }) {
    return (
        <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
                <SiteLogo />
                {current > 0 && (
                    <ol className="text-muted-foreground hidden items-center gap-2 text-xs font-medium md:flex" aria-label="Setup steps">
                        {steps.map((label, i) => {
                            const n = i + 1;
                            const state = n < current ? 'done' : n === current ? 'current' : 'next';
                            return (
                                <li key={label} className="flex items-center gap-2">
                                    {i > 0 && <span className="bg-border h-px w-6" aria-hidden />}
                                    <span
                                        className={cn('flex items-center gap-1.5', state === 'current' && 'text-foreground')}
                                        aria-current={state === 'current' ? 'step' : undefined}
                                    >
                                        <span
                                            className={cn(
                                                'flex size-5 items-center justify-center rounded-full text-[10px]',
                                                state === 'done' && 'bg-status-met/15 text-status-met',
                                                state === 'current' && 'bg-primary text-primary-foreground',
                                                state === 'next' && 'bg-muted',
                                            )}
                                        >
                                            {state === 'done' ? <Check className="size-3" strokeWidth={3} /> : n}
                                        </span>
                                        {label}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                )}
                <ThemeToggle />
            </div>
        </header>
    );
}
