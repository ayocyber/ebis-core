import { StatusBadge } from '@/components/ebis/badges';
import { SiteLogo } from '@/components/marketing/site-header';
import { PoweredByEbis } from '@/components/powered-by-ebis';
import { ThemeToggle } from '@/components/theme-toggle';
import { BadgeCheck, FileText, Quote, Sparkles } from 'lucide-react';

interface Props {
    children: React.ReactNode;
    title?: string;
    description?: string;
}

/**
 * Premium split auth layout: form on the left, a living product
 * showcase on the right (lg+). Works in light and dark mode.
 */
export default function AuthPremiumLayout({ children, title, description }: Props) {
    return (
        <div className="bg-background text-foreground grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            {/* Form side */}
            <div className="relative flex flex-col px-5 py-6 sm:px-10">
                <div className="flex items-center justify-between">
                    <SiteLogo />
                    <ThemeToggle />
                </div>

                <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
                    <div className="animate-fade-up mb-8 space-y-2">
                        <h1 className="text-gradient text-[1.75rem] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
                        {description && <p className="text-muted-foreground text-sm">{description}</p>}
                    </div>
                    <div className="animate-fade-up [animation-delay:80ms] [&_button[type=submit]]:h-11 [&_button[type=submit]]:rounded-lg [&_button[type=submit]]:shadow-[0_10px_28px_-12px_var(--glow)] [&_input]:h-11 [&_input]:rounded-lg">
                        {children}
                    </div>
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span>© {new Date().getFullYear()} EBIS Tech Group</span>
                    <PoweredByEbis compact className="px-0" />
                </div>
            </div>

            {/* Showcase side */}
            <aside className="relative m-3 hidden overflow-hidden rounded-3xl border lg:flex lg:flex-col lg:justify-between">
                <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_oklab,var(--glow)_28%,transparent),transparent_60%),radial-gradient(90%_70%_at_0%_100%,color-mix(in_oklab,var(--brand-accent)_18%,transparent),transparent_60%)]" />
                <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_60%_40%,black,transparent)]" />

                <div className="relative p-10 xl:p-14">
                    <p className="text-muted-foreground bg-background/50 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
                        <Sparkles className="text-primary size-3.5" /> Tender intelligence
                    </p>
                    <h2 className="text-gradient mt-6 max-w-md text-4xl leading-[1.05] font-semibold tracking-[-0.035em] xl:text-5xl">
                        Bid on the tenders you can win.
                    </h2>
                    <ul className="text-muted-foreground mt-6 space-y-2.5 text-sm">
                        {[
                            'Every requirement checked against your documents',
                            'The exact clause behind each answer',
                            'Blockers flagged with a fix and a timeline',
                        ].map((t) => (
                            <li key={t} className="flex items-center gap-2">
                                <BadgeCheck className="text-status-met size-4 shrink-0" /> {t}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Floating product cards */}
                <div className="relative h-[340px] xl:h-[380px]">
                    <div className="bg-card/90 animate-float absolute top-2 right-[-40px] w-[440px] rounded-2xl border p-4 shadow-2xl backdrop-blur xl:right-6">
                        <div className="flex items-center justify-between">
                            <p className="text-muted-foreground font-mono text-[11px]">NCC/ICT/2026/014</p>
                            <span className="text-muted-foreground text-[11px]">Eligibility</span>
                        </div>
                        <div className="mt-3 space-y-1.5">
                            {(
                                [
                                    ['M-02', 'HMRC tax compliance', 'met'],
                                    ['M-03', 'Cyber Essentials Plus certificate', 'not_met'],
                                    ['M-07', 'Average turnover ≥ £2m', 'partially_met'],
                                    ['M-10', 'OEM manufacturer authorisation', 'unknown'],
                                ] as const
                            ).map(([code, title, status]) => (
                                <div key={code} className="bg-background/70 flex items-center gap-3 rounded-lg border px-3 py-2">
                                    <span className="text-muted-foreground w-9 font-mono text-[10px]">{code}</span>
                                    <span className="min-w-0 flex-1 truncate text-xs">{title}</span>
                                    <StatusBadge status={status} className="text-[10px]" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-card/95 absolute bottom-10 left-10 w-[300px] [animation:float_7s_ease-in-out_infinite_1s] rounded-2xl border p-4 shadow-2xl backdrop-blur">
                        <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase">
                            <Quote className="size-3" /> Tender clause
                        </p>
                        <p className="border-primary/50 mt-2 border-l-2 pl-2.5 text-xs leading-relaxed">
                            Bidders must hold a current Cyber Essentials Plus certificate{' '}
                            <mark className="bg-primary/15 text-foreground rounded-sm px-0.5">valid at the contract start date</mark>.
                        </p>
                        <p className="text-muted-foreground mt-2.5 flex items-center gap-1 text-[10px]">
                            <FileText className="size-3" /> Invitation to Tender · p. 7
                        </p>
                    </div>
                </div>
            </aside>
        </div>
    );
}
