import { SectionHeading } from '@/components/marketing/primitives';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

const before = [
    'Reading 100+ page tender packs line by line, late at night',
    'Finding out your Cyber Essentials certificate expired after you submitted',
    'Spending weeks on bids you were never eligible for',
    'Requirements tracked in spreadsheets, emails and WhatsApp threads',
    'Disqualified at preliminary evaluation over one missing form',
];

const after = [
    'Every requirement pulled out and checked in minutes',
    'Expiry alerts before a certificate can sink a bid',
    'A clear Go / No-Go before anyone writes a word',
    'One shared matrix with owners, fixes and deadlines',
    'A readiness check that catches the missing form before the buyer does',
];

/** "Without vs With" switch — makes the pain and the payoff concrete. */
export function Comparison() {
    return (
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
            <SectionHeading
                eyebrow="The switch"
                title="Stop losing bids on paperwork."
                text="Most SME bids aren’t lost on price. They’re lost on a missing certificate or a clause nobody read."
            />

            <div className="mt-14 grid gap-4 md:grid-cols-2">
                <Column tone="before" title="Without EBIS Core" items={before} />
                <Column tone="after" title="With EBIS Core" items={after} />
            </div>
        </section>
    );
}

function Column({ tone, title, items }: { tone: 'before' | 'after'; title: string; items: string[] }) {
    const isAfter = tone === 'after';

    return (
        <div
            className={cn(
                'reveal relative overflow-hidden rounded-2xl border p-6 sm:p-8',
                isAfter
                    ? 'border-primary/30 bg-card shadow-[0_20px_60px_-30px_var(--glow)] [transition-delay:120ms]'
                    : 'bg-muted/40 dark:bg-muted/20',
            )}
        >
            {isAfter && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,color-mix(in_oklab,var(--glow)_14%,transparent),transparent_70%)]"
                />
            )}
            <div className="relative">
                <p className={cn('text-sm font-semibold', isAfter ? 'text-primary' : 'text-muted-foreground')}>{title}</p>
                <ul className="mt-6 space-y-4">
                    {items.map((item) => (
                        <li key={item} className="flex gap-3 text-sm leading-relaxed sm:text-[15px]">
                            <span
                                className={cn(
                                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                                    isAfter ? 'bg-status-met/15 text-status-met' : 'bg-brand-accent/10 text-brand-accent',
                                )}
                            >
                                {isAfter ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                            </span>
                            <span className={isAfter ? 'text-foreground' : 'text-muted-foreground'}>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
