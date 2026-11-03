import { SectionHeading } from '@/components/marketing/primitives';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowRight, Building, Check } from 'lucide-react';
import { useState } from 'react';

type Billing = 'monthly' | 'yearly';

interface Plan {
    name: string;
    blurb: string;
    /** Pounds per month (ex. VAT); null = free. Yearly is charged as 10 months. */
    monthly: number | null;
    cta: string;
    popular?: boolean;
    features: string[];
}

/**
 * DRAFT PRICING — placeholder figures for review by EBIS management.
 * Edit this array to change every price on the site.
 */
export const plans: Plan[] = [
    {
        name: 'Starter',
        blurb: 'Try it on your next tender.',
        monthly: null,
        cta: 'Start free',
        features: ['2 tender checks a month', '1 user', 'Eligibility matrix with cited clauses', 'Company evidence vault'],
    },
    {
        name: 'Growth',
        blurb: 'For SMEs bidding every month.',
        monthly: 79,
        cta: 'Start 14-day trial',
        popular: true,
        features: [
            '15 tender checks a month',
            'Up to 5 users',
            'Gap analysis and Go / No-Go',
            'Certificate expiry alerts',
            'Compliance matrix export',
        ],
    },
    {
        name: 'Business',
        blurb: 'For teams that live in tenders.',
        monthly: 199,
        cta: 'Start 14-day trial',
        features: [
            'Unlimited tender checks',
            'Unlimited users',
            'AI bid drafting with citations',
            'Readiness validation and sign-off',
            'Priority support',
        ],
    },
];

const gbp = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

export function Pricing() {
    const [billing, setBilling] = useState<Billing>('monthly');

    return (
        <section id="pricing" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
            <SectionHeading
                eyebrow="Pricing"
                title="Priced for SMEs, not multinationals."
                text="Start free. Upgrade when EBIS Core wins you a tender."
            />

            <div className="reveal mt-10 flex justify-center">
                <div role="radiogroup" aria-label="Billing period" className="bg-muted/60 inline-flex items-center gap-0.5 rounded-full border p-1">
                    {(['monthly', 'yearly'] as const).map((b) => (
                        <button
                            key={b}
                            role="radio"
                            aria-checked={billing === b}
                            onClick={() => setBilling(b)}
                            className={cn(
                                'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all',
                                billing === b
                                    ? 'bg-card text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {b === 'monthly' ? 'Monthly' : 'Yearly'}
                            {b === 'yearly' && (
                                <span className="bg-status-met/15 text-status-met rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                                    2 months free
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
                {plans.map((plan, i) => (
                    <PlanCard key={plan.name} plan={plan} billing={billing} delay={i * 80} />
                ))}
            </div>

            <div className="reveal bg-muted/30 mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                    <span className="bg-background flex size-10 shrink-0 items-center justify-center rounded-xl border">
                        <Building className="text-primary size-5" />
                    </span>
                    <div>
                        <p className="font-semibold">Enterprise and consortia</p>
                        <p className="text-muted-foreground text-sm">Joint-venture workspaces, SSO, custom onboarding and on-site training.</p>
                    </div>
                </div>
                <Button asChild variant="outline" className="rounded-full">
                    <a href="mailto:info@ebistechgroup.com">Talk to sales</a>
                </Button>
            </div>

            <p className="text-muted-foreground mt-6 text-center text-xs">
                Prices exclude VAT. Paid plans start with a 14-day free trial. Cancel anytime.
            </p>
        </section>
    );
}

function PlanCard({ plan, billing, delay }: { plan: Plan; billing: Billing; delay: number }) {
    const free = plan.monthly === null;
    const perMonth = free ? 0 : billing === 'yearly' ? Math.round((plan.monthly! * 10) / 12) : plan.monthly!;

    return (
        <div
            style={{ transitionDelay: `${delay}ms` }}
            className={cn(
                'reveal relative flex flex-col rounded-2xl border p-6 sm:p-7',
                plan.popular ? 'border-primary/40 bg-card ring-primary/20 shadow-[0_30px_80px_-40px_var(--glow)] ring-1' : 'bg-card dark:bg-card/70',
            )}
        >
            {plan.popular && (
                <>
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(90%_50%_at_50%_0%,color-mix(in_oklab,var(--glow)_12%,transparent),transparent_70%)]"
                    />
                    <span className="from-primary to-brand-accent absolute -top-3 left-6 rounded-full bg-gradient-to-r px-3 py-1 text-[11px] font-semibold text-white shadow-md">
                        Most popular
                    </span>
                </>
            )}

            <div className="relative flex flex-1 flex-col">
                <p className="font-semibold">{plan.name}</p>
                <p className="text-muted-foreground mt-1 text-sm">{plan.blurb}</p>

                <div className="mt-6 flex items-baseline gap-1.5">
                    <span key={`${billing}-${plan.name}`} className="animate-fade-up text-4xl font-semibold tracking-[-0.03em] tabular-nums">
                        {free ? '£0' : gbp(perMonth)}
                    </span>
                    <span className="text-muted-foreground text-sm">/ month</span>
                </div>
                <p className="text-muted-foreground mt-1 h-4 text-xs">
                    {free ? 'Free forever' : billing === 'yearly' ? `${gbp(plan.monthly! * 10)} billed yearly` : 'Billed monthly'}
                </p>

                <Button
                    asChild
                    variant={plan.popular ? 'default' : 'outline'}
                    className={cn('mt-6 h-10 rounded-full', plan.popular && 'shadow-[0_10px_28px_-12px_var(--glow)]')}
                >
                    <Link href={route('register')}>
                        {plan.cta} <ArrowRight />
                    </Link>
                </Button>

                <ul className="mt-7 space-y-3 border-t pt-6 text-sm">
                    {plan.features.map((f) => (
                        <li key={f} className="flex gap-2.5">
                            <Check className="text-primary mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
                            {f}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
