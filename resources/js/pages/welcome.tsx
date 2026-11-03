import { ConfidenceMeter, StatusBadge } from '@/components/ebis/badges';
import { ScoreGauge } from '@/components/eligibility/eligibility-summary';
import { Comparison } from '@/components/marketing/comparison';
import { Pricing } from '@/components/marketing/pricing';
import { Backdrop, Eyebrow, SectionHeading, SpotlightCard } from '@/components/marketing/primitives';
import { ProductShot } from '@/components/marketing/product-shot';
import { SiteHeader, siteLinks, SiteLogo } from '@/components/marketing/site-header';
import { PoweredByEbis } from '@/components/powered-by-ebis';
import { Button } from '@/components/ui/button';
import { useReveal } from '@/hooks/use-reveal';
import { stages } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    CalendarClock,
    ChevronRight,
    FileText,
    FileUp,
    Gauge,
    ListChecks,
    Mail,
    PenLine,
    Phone,
    Plus,
    Quote,
    ShieldCheck,
    Sparkles,
    Users,
    Wrench,
} from 'lucide-react';

export default function Welcome() {
    useReveal();

    return (
        <>
            <Head title="Win the tenders you qualify for" />
            <div className="bg-background text-foreground min-h-screen overflow-x-clip">
                <SiteHeader />
                <main>
                    <Hero />
                    <Facts />
                    <Comparison />
                    <Features />
                    <Workflow />
                    <Pricing />
                    <Faq />
                    <FinalCta />
                </main>
                <SiteFooter />
            </div>
        </>
    );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
    const { auth } = usePage<SharedData>().props;

    return (
        <section id="product" className="relative scroll-mt-16">
            <Backdrop />
            <div className="relative mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24 2xl:max-w-[1400px]">
                <div className="mx-auto max-w-3xl text-center">
                    <a
                        href="#features"
                        className="animate-fade-up bg-card/70 hover:border-primary/40 group inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs shadow-sm backdrop-blur transition-colors"
                    >
                        <span className="bg-brand-accent rounded-full px-2 py-0.5 text-[10px] font-semibold text-white">NEW</span>
                        <span className="text-muted-foreground">Clause-level evidence for every answer</span>
                        <ChevronRight className="text-muted-foreground size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </a>

                    <h1 className="animate-fade-up text-gradient mt-7 text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance [animation-delay:60ms] sm:text-6xl md:text-7xl">
                        Win the tenders you <span className="text-gradient-brand animate-shine">actually qualify for.</span>
                    </h1>

                    <p className="animate-fade-up text-muted-foreground mx-auto mt-6 max-w-2xl text-base text-pretty [animation-delay:120ms] sm:text-lg">
                        EBIS Core reads the whole tender pack, checks every requirement against your company’s documents and shows the proof behind
                        each answer — so your team only writes the bids it can win.
                    </p>

                    <div className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 [animation-delay:180ms] sm:flex-row">
                        <Button
                            asChild
                            size="lg"
                            className="h-12 w-full rounded-full px-7 text-[15px] shadow-[0_12px_32px_-10px_var(--glow)] sm:w-auto"
                        >
                            <Link href={auth.user ? route('dashboard') : route('register')}>
                                {auth.user ? 'Open EBIS Core' : 'Start checking tenders'} <ArrowRight />
                            </Link>
                        </Button>
                        <Button
                            asChild
                            size="lg"
                            variant="outline"
                            className="bg-card/60 h-12 w-full rounded-full px-7 text-[15px] backdrop-blur sm:w-auto"
                        >
                            <a href="#workflow">See how it works</a>
                        </Button>
                    </div>

                    <p className="animate-fade-up text-muted-foreground mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs [animation-delay:240ms]">
                        {['Cyber Essentials · ISO · insurance checks', 'Every answer cited', 'Built for bid teams'].map((t) => (
                            <span key={t} className="flex items-center gap-1.5">
                                <BadgeCheck className="text-status-met size-3.5" /> {t}
                            </span>
                        ))}
                    </p>
                </div>

                <div className="animate-fade-up mx-auto mt-16 max-w-5xl [animation-delay:320ms] sm:mt-20 2xl:max-w-[1320px]">
                    <div className="[perspective:2400px]">
                        <div className="[transform:rotateX(10deg)] transition-transform duration-700 ease-out hover:[transform:rotateX(0deg)] max-md:[transform:none]">
                            <ProductShot />
                        </div>
                    </div>
                </div>
            </div>
            <div aria-hidden className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t to-transparent" />
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Facts strip                                                         */
/* ------------------------------------------------------------------ */

const facts = [
    { value: '10', label: 'guided stages from intake to sign-off' },
    { value: '4', label: 'clear statuses — and “Unknown” is never a guess' },
    { value: '50 MB', label: 'tender packs in PDF, DOCX or ZIP' },
    { value: '1 click', label: 'from any answer to the exact clause' },
];

function Facts() {
    return (
        <section className="relative mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28 2xl:max-w-7xl">
            <div className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-2xl border md:grid-cols-4">
                {facts.map((f, i) => (
                    <div key={f.label} className="reveal bg-background p-5 sm:p-7" style={{ transitionDelay: `${i * 70}ms` }}>
                        <p className="text-gradient text-3xl font-semibold tracking-tight sm:text-4xl">{f.value}</p>
                        <p className="text-muted-foreground mt-2 text-sm leading-snug">{f.label}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Features bento                                                      */
/* ------------------------------------------------------------------ */

function Features() {
    return (
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32 2xl:max-w-7xl">
            <SectionHeading
                eyebrow="Features"
                title={
                    <>
                        Everything you need to
                        <br className="hidden sm:block" /> bid with confidence.
                    </>
                }
                text="One workspace for the whole bid: qualify, fix the gaps, write the answers and check them before you submit."
            />

            <div className="mt-14 grid gap-4 md:grid-cols-6">
                <BentoCard
                    className="md:col-span-4"
                    icon={ListChecks}
                    title="Eligibility matrix"
                    text="Every requirement, sorted into mandatory, scored and informational — with a status you can trust."
                >
                    <MatrixVisual />
                </BentoCard>
                <BentoCard
                    className="md:col-span-2"
                    icon={Quote}
                    title="Clause-level evidence"
                    text="Click any status to see the exact words, page and section it rests on."
                    delay={80}
                >
                    <EvidenceVisual />
                </BentoCard>
                <BentoCard
                    className="md:col-span-2"
                    icon={CalendarClock}
                    title="Expiry radar"
                    text="Certificates are checked against the tender’s dates, not today’s."
                    delay={0}
                >
                    <ExpiryVisual />
                </BentoCard>
                <BentoCard
                    className="md:col-span-2"
                    icon={Wrench}
                    title="Gaps with remedies"
                    text="Each gap gets a severity, a fix and the days it takes to close."
                    delay={80}
                >
                    <GapVisual />
                </BentoCard>
                <BentoCard
                    className="md:col-span-2"
                    icon={Gauge}
                    title="Readiness score"
                    text="Know when a bid is ready — and what’s stopping it."
                    delay={160}
                >
                    <div className="flex justify-center pt-2">
                        <ScoreGauge value={86} size={150} />
                    </div>
                </BentoCard>
                <BentoCard
                    className="md:col-span-3"
                    icon={Users}
                    title="Made for bid teams"
                    text="Owners decide Go / No-Go, editors prepare, viewers follow along. Every change is logged with a reason."
                >
                    <TeamVisual />
                </BentoCard>
                <BentoCard
                    className="md:col-span-3"
                    icon={PenLine}
                    title="Draft with citations"
                    text="Answers pull facts from your profile, and unsupported claims are flagged before an evaluator sees them."
                    delay={80}
                >
                    <DraftVisual />
                </BentoCard>
            </div>
        </section>
    );
}

function BentoCard({
    className,
    icon: Icon,
    title,
    text,
    children,
    delay = 0,
}: {
    className?: string;
    icon: typeof ListChecks;
    title: string;
    text: string;
    children: React.ReactNode;
    delay?: number;
}) {
    return (
        <SpotlightCard className={cn('reveal flex flex-col', className)} style={{ transitionDelay: `${delay}ms` }}>
            <div className="flex h-full flex-col">
                <div className="relative min-h-44 flex-1 overflow-hidden px-5 pt-5 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
                    {children}
                </div>
                <div className="p-5 pt-3">
                    <h3 className="flex items-center gap-2 font-semibold">
                        <Icon className="text-primary size-4" /> {title}
                    </h3>
                    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{text}</p>
                </div>
            </div>
        </SpotlightCard>
    );
}

function MatrixVisual() {
    const items = [
        ['M-02', 'HMRC tax compliance', 'met', 0.97],
        ['M-03', 'Cyber Essentials Plus certificate', 'not_met', 0.93],
        ['M-07', 'Average turnover ≥ £2m', 'partially_met', 0.84],
        ['M-10', 'OEM manufacturer authorisation', 'unknown', 0.52],
        ['S-02', 'Key personnel qualifications', 'met', 0.95],
    ] as const;
    return (
        <div className="bg-background/60 rounded-xl border">
            {items.map(([code, title, status, conf]) => (
                <div key={code} className="flex items-center gap-3 border-t px-3 py-2.5 first:border-t-0">
                    <span className="text-muted-foreground w-9 font-mono text-[11px]">{code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
                    <ConfidenceMeter value={conf} showLabel={false} className="hidden sm:flex" />
                    <StatusBadge status={status} />
                </div>
            ))}
        </div>
    );
}

function EvidenceVisual() {
    return (
        <div className="bg-background/60 rounded-xl border p-3">
            <p className="border-primary/50 border-l-2 pl-2.5 text-[13px] leading-relaxed">
                Bidders shall demonstrate an average annual turnover of{' '}
                <mark className="bg-primary/15 text-foreground rounded-sm px-0.5 font-medium">not less than £2,000,000</mark> over the last three
                financial years.
            </p>
            <p className="text-muted-foreground mt-3 flex items-center gap-1.5 border-t pt-2.5 text-[11px]">
                <FileText className="size-3.5" /> Invitation to Tender · p. 9 · § 5.2(a)
            </p>
        </div>
    );
}

function ExpiryVisual() {
    const certs = [
        ['Employer’s liability', 'Valid to Mar 2027', 'bg-status-met', 82],
        ['Cyber Essentials Plus', 'Expired Oct 2026', 'bg-status-not-met', 100],
        ['ISO 9001', 'Valid to Jun 2027', 'bg-status-met', 70],
        ['ISO 27001', 'Valid to Apr 2028', 'bg-status-met', 40],
    ] as const;
    return (
        <div className="space-y-3">
            {certs.map(([name, note, tone, w]) => (
                <div key={name}>
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{name}</span>
                        <span className={cn('text-muted-foreground', tone === 'bg-status-not-met' && 'text-status-not-met font-medium')}>{note}</span>
                    </div>
                    <div className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full">
                        <div className={cn('h-full rounded-full', tone)} style={{ width: `${w}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function GapVisual() {
    return (
        <div className="space-y-2.5">
            {[
                ['Blocker', 'Turnover below threshold', 'JV partner · ~14 days', 'bg-red-500/10 text-red-600 dark:text-red-300'],
                ['Fixable', 'Bank letter not addressed', 'Re-issue · ~3 days', 'bg-amber-500/10 text-amber-700 dark:text-amber-300'],
                ['Minor', 'Add project references', 'Records · ~4 days', 'bg-muted text-muted-foreground'],
            ].map(([sev, title, fix, tone]) => (
                <div key={title} className="bg-background/60 rounded-lg border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium">{title}</span>
                        <span className={cn('shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase', tone)}>{sev}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-[11px]">{fix}</p>
                </div>
            ))}
        </div>
    );
}

function TeamVisual() {
    const people = [
        ['AO', 'Adaeze Okafor', 'Owner', 'from-violet-500 to-indigo-500'],
        ['TB', 'Tunde Bakare', 'Editor', 'from-cyan-500 to-sky-500'],
        ['IN', 'Ifeoma Nwosu', 'Editor', 'from-emerald-500 to-teal-500'],
        ['KA', 'Kemi Adeyemi', 'Viewer', 'from-amber-500 to-orange-500'],
    ];
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {people.map(([ini, name, role, grad]) => (
                <div key={name} className="bg-background/60 flex items-center gap-3 rounded-lg border p-2.5">
                    <span
                        className={cn(
                            'flex size-8 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white',
                            grad,
                        )}
                    >
                        {ini}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="text-muted-foreground text-xs">{role}</p>
                    </div>
                </div>
            ))}
            <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-2.5 text-xs sm:col-span-2">
                <Sparkles className="text-primary size-3.5" /> Adaeze changed M-08 to “Partially met” — “Auditor re-issued FY2025 accounts.”
            </div>
        </div>
    );
}

function DraftVisual() {
    return (
        <div className="bg-background/60 rounded-xl border p-4 text-sm leading-relaxed">
            <p>
                Bluewave delivered a 1,400-node LAN and Wi-Fi refresh for a regional NHS trust’s head office
                <span className="bg-primary/12 text-primary mx-1 rounded px-1.5 py-px align-middle text-[10px] font-semibold">Case study ↗</span>,
                led by a CCIE-certified engineer
                <span className="bg-primary/12 text-primary mx-1 rounded px-1.5 py-px align-middle text-[10px] font-semibold">CV ↗</span>.{' '}
                <span className="decoration-status-partial underline decoration-wavy decoration-2 underline-offset-4">
                    We have delivered 20+ public sector projects.
                </span>
            </p>
            <p className="text-status-partial mt-3 flex items-center gap-1.5 text-xs font-medium">
                <ShieldCheck className="size-3.5" /> No profile fact supports “20+ public sector projects”.
            </p>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Workflow                                                            */
/* ------------------------------------------------------------------ */

const steps = [
    { icon: FileUp, title: 'Upload the tender', text: 'Drop the pack. Buyer, deadline, value and every requirement are extracted for you.' },
    { icon: ListChecks, title: 'Check eligibility', text: 'Each requirement is matched to your documents with a status and the evidence behind it.' },
    {
        icon: ShieldCheck,
        title: 'Close gaps, then decide',
        text: 'Fix blockers with clear remedies and make the Go / No-Go call on facts, with reasons logged.',
    },
    {
        icon: PenLine,
        title: 'Draft, validate, sign off',
        text: 'Write cited answers, get a readiness score and sign off when everything checks out.',
    },
];

function Workflow() {
    return (
        <section id="workflow" className="bg-muted/30 relative scroll-mt-16 border-y">
            <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32 2xl:max-w-7xl">
                <SectionHeading
                    eyebrow="Workflow"
                    title="From tender pack to sign-off."
                    text="Ten guided stages, in four simple steps. Your team always knows what’s next."
                />

                <ol className="relative mt-16 grid gap-8 md:grid-cols-4 md:gap-6">
                    <div
                        aria-hidden
                        className="via-primary/40 absolute top-6 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent to-transparent md:block"
                    />
                    {steps.map((s, i) => (
                        <li key={s.title} className="reveal relative text-center" style={{ transitionDelay: `${i * 90}ms` }}>
                            <span className="bg-background ring-border relative mx-auto flex size-12 items-center justify-center rounded-2xl shadow-sm ring-1">
                                <s.icon className="text-primary size-5" />
                                <span className="bg-brand-accent absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-[0_4px_12px_-2px_var(--brand-accent)]">
                                    {i + 1}
                                </span>
                            </span>
                            <h3 className="mt-5 font-semibold">{s.title}</h3>
                            <p className="text-muted-foreground mx-auto mt-2 max-w-60 text-sm leading-relaxed">{s.text}</p>
                        </li>
                    ))}
                </ol>

                <div className="reveal mt-14 flex flex-wrap items-center justify-center gap-2">
                    {stages.map((s, i) => (
                        <span
                            key={s.id}
                            className="bg-background text-muted-foreground flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
                        >
                            <span className="text-foreground font-mono text-[10px]">{String(i + 1).padStart(2, '0')}</span>
                            {s.label}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

const faqs = [
    {
        q: 'What documents can I upload?',
        a: 'Tender packs in PDF, DOCX or ZIP up to 50 MB each — invitations to tender, specifications, award criteria and forms. EBIS Core extracts the metadata and every requirement automatically.',
    },
    {
        q: 'How does it decide if we meet a requirement?',
        a: 'It compares the tender clause with facts in your company profile — certificates, accounts, CVs, case studies. Every status links to the clause and the fact used, so you can check the reasoning yourself.',
    },
    {
        q: 'What happens when there is no evidence?',
        a: 'The requirement is marked “Unknown”, never guessed as “Met”. Unknowns are surfaced as “needs your input” so someone on your team can confirm or upload the document.',
    },
    {
        q: 'Can my team disagree with a result?',
        a: 'Yes. Editors and owners can change any status, but they must give a reason. The change, the person and the reason are kept in the audit trail.',
    },
    {
        q: 'Is it built for UK public sector tenders?',
        a: 'Yes. It understands Procurement Act 2023 requirements such as Central Digital Platform registration, Carbon Reduction Plans, Cyber Essentials, ISO certifications and insurance levels, and reads notices from Find a Tender and Contracts Finder.',
    },
];

function Faq() {
    return (
        <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-20 gap-12 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-[1fr_1.4fr] 2xl:max-w-7xl">
            <div className="reveal space-y-4">
                <Eyebrow>FAQ</Eyebrow>
                <h2 className="text-gradient text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Questions, answered.</h2>
                <p className="text-muted-foreground">
                    Can’t find what you need?{' '}
                    <a href="mailto:info@ebistechgroup.com" className="text-foreground underline-offset-4 hover:underline">
                        Talk to the team
                    </a>
                    .
                </p>
            </div>
            <div className="divide-y border-y">
                {faqs.map((f, i) => (
                    <details key={f.q} className="reveal group py-1" style={{ transitionDelay: `${i * 60}ms` }} open={i === 0}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-medium [&::-webkit-details-marker]:hidden">
                            {f.q}
                            <span className="text-muted-foreground group-open:bg-primary group-open:text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full border transition-all group-open:rotate-45 group-open:border-transparent">
                                <Plus className="size-3.5" />
                            </span>
                        </summary>
                        <p className="text-muted-foreground pr-10 pb-5 text-sm leading-relaxed">{f.a}</p>
                    </details>
                ))}
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCta() {
    const { auth } = usePage<SharedData>().props;
    return (
        <section className="px-4 pb-24 sm:px-6 sm:pb-32">
            <div className="reveal relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#00036C] px-6 py-16 text-center text-white shadow-[0_30px_80px_-30px_rgba(0,3,108,0.7)] sm:px-12 sm:py-24 2xl:max-w-7xl dark:bg-[#05087a]">
                {/* EBIS blue field with a red glow and dot texture */}
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_90%_at_50%_0%,rgba(47,59,255,0.75),transparent_65%)]" />
                <div aria-hidden className="animate-glow absolute -right-24 -bottom-32 h-80 w-80 rounded-full bg-[#E3262C]/45 blur-[100px]" />
                <div aria-hidden className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#2F3BFF]/40 blur-[90px]" />
                <div
                    aria-hidden
                    className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:22px_22px] opacity-[0.18] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_30%,black,transparent)]"
                />
                <div className="relative mx-auto max-w-2xl">
                    <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
                        <span className="size-1.5 rounded-full bg-[#FF3B41]" /> Ready when you are
                    </p>
                    <h2 className="mt-6 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
                        Check your next tender in minutes, not days.
                    </h2>
                    <p className="mx-auto mt-5 max-w-lg text-base text-white/70 sm:text-lg">
                        Upload one tender pack and see exactly where you stand — before anyone writes a word.
                    </p>
                    <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Button
                            asChild
                            size="lg"
                            className="h-12 w-full rounded-full bg-white px-7 text-[15px] text-[#00036C] hover:bg-white/90 sm:w-auto"
                        >
                            <Link href={auth.user ? route('dashboard') : route('register')}>
                                {auth.user ? 'Open EBIS Core' : 'Create your account'} <ArrowRight />
                            </Link>
                        </Button>
                        <Button
                            asChild
                            size="lg"
                            className="h-12 w-full rounded-full bg-[#E3262C] px-7 text-[15px] text-white shadow-[0_12px_32px_-10px_rgba(227,38,44,0.8)] hover:bg-[#cc1f25] sm:w-auto"
                        >
                            <a href="mailto:info@ebistechgroup.com">Book a walkthrough</a>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function SiteFooter() {
    return (
        <footer className="border-t">
            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] 2xl:max-w-7xl">
                <div className="space-y-4">
                    <SiteLogo />
                    <p className="text-muted-foreground max-w-xs text-sm">
                        Tender eligibility, gap analysis and bid readiness for growing businesses.
                    </p>
                    <PoweredByEbis className="-ml-2" />
                </div>
                <div className="space-y-3 text-sm">
                    <p className="font-medium">Product</p>
                    <ul className="text-muted-foreground space-y-2.5">
                        {siteLinks.map((l) => (
                            <li key={l.href}>
                                <a href={l.href} className="hover:text-foreground transition-colors">
                                    {l.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="space-y-3 text-sm">
                    <p className="font-medium">Contact</p>
                    <ul className="text-muted-foreground space-y-2.5">
                        <li>
                            <a
                                href="mailto:info@ebistechgroup.com"
                                className="hover:text-foreground inline-flex items-center gap-2 transition-colors"
                            >
                                <Mail className="size-4" /> info@ebistechgroup.com
                            </a>
                        </li>
                        <li>
                            <a href="tel:+2349024976746" className="hover:text-foreground inline-flex items-center gap-2 transition-colors">
                                <Phone className="size-4" /> +234 902 497 6746
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 border-t px-4 py-6 text-xs sm:flex-row sm:px-6 2xl:max-w-7xl">
                <span>© {new Date().getFullYear()} EBIS Tech Group. All rights reserved.</span>
                <span>Built for UK SMEs 🇬🇧</span>
            </div>
        </footer>
    );
}
