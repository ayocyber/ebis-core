import { TenderHeader } from '@/components/ebis/tender-header';
import { TenderNotFound } from '@/components/ebis/tender-not-found';
import { computeStats, ScoreGauge } from '@/components/eligibility/eligibility-summary';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { findTender } from '@/data/mock-ebis';
import { useTenderWorkspace } from '@/hooks/use-tender-workspace';
import AppLayout from '@/layouts/app-layout';
import { addWorkingDays, type FactorTone, recommend, type Verdict, verdictMeta } from '@/lib/decision';
import { formatDate, formatMoney } from '@/lib/ebis';
import { isOwner } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { DecisionOutcome } from '@/types/ebis';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    CircleAlert,
    CircleCheck,
    CircleX,
    Gavel,
    Lock,
    RotateCcw,
    ShieldCheck,
    ThumbsDown,
    ThumbsUp,
    TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';

const verdictStyle: Record<Verdict, { icon: typeof CheckCircle2; ring: string; chip: string; glow: string }> = {
    go: {
        icon: CircleCheck,
        ring: 'border-status-met/30',
        chip: 'bg-status-met/12 text-status-met',
        glow: 'color-mix(in oklab, var(--status-met) 16%, transparent)',
    },
    conditional: {
        icon: TriangleAlert,
        ring: 'border-status-partial/35',
        chip: 'bg-status-partial/12 text-status-partial',
        glow: 'color-mix(in oklab, var(--status-partial) 16%, transparent)',
    },
    no_go: {
        icon: CircleX,
        ring: 'border-status-not-met/30',
        chip: 'bg-status-not-met/12 text-status-not-met',
        glow: 'color-mix(in oklab, var(--status-not-met) 16%, transparent)',
    },
};

const toneIcon: Record<FactorTone, { icon: typeof CircleCheck; className: string; label: string }> = {
    good: { icon: CircleCheck, className: 'text-status-met', label: 'Good' },
    warn: { icon: CircleAlert, className: 'text-status-partial', label: 'Watch' },
    bad: { icon: CircleX, className: 'text-status-not-met', label: 'Risk' },
};

const shortDate = (d: Date) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);

export default function TenderDecision({ tenderId }: { tenderId: string }) {
    const { role, auth } = usePage<SharedData>().props;
    const tender = findTender(tenderId);
    const { rows, decision, setDecision } = useTenderWorkspace(tenderId);

    const rec = useMemo(() => (tender ? recommend(rows, tender) : null), [rows, tender]);
    const score = useMemo(() => computeStats(rows).score, [rows]);

    if (!tender || !rec) return <TenderNotFound />;

    const style = verdictStyle[rec.verdict];
    const VerdictIcon = style.icon;

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference, href: `/tenders/${tender.id}/eligibility` },
                { title: 'Go / No-Go', href: `/tenders/${tender.id}/decision` },
            ]}
        >
            <Head title={`Go / No-Go · ${tender.reference}`} />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <TenderHeader
                    tender={tender}
                    viewing="decision"
                    actions={
                        <Button variant="outline" size="sm" asChild>
                            <Link href={route('tenders.gaps', tender.id)}>
                                <ArrowLeft className="size-4" /> Gap analysis
                            </Link>
                        </Button>
                    }
                />

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="space-y-6">
                        {/* Recommendation */}
                        <section
                            className={cn('bg-card animate-fade-up relative overflow-hidden rounded-2xl border p-5 sm:p-7', style.ring)}
                            aria-labelledby="rec-title"
                        >
                            <div
                                aria-hidden
                                className="pointer-events-none absolute inset-0"
                                style={{ background: `radial-gradient(70% 90% at 0% 0%, ${style.glow}, transparent 70%)` }}
                            />
                            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                                <div className="min-w-0 flex-1 space-y-3">
                                    <p className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">EBIS recommendation</p>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold',
                                                style.chip,
                                            )}
                                        >
                                            <VerdictIcon className="size-4" /> {verdictMeta[rec.verdict].label}
                                        </span>
                                    </div>
                                    <h2 id="rec-title" className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
                                        {rec.headline}
                                    </h2>
                                    <p className="text-muted-foreground max-w-xl text-pretty">{rec.rationale}</p>
                                </div>
                                <div className="flex shrink-0 flex-col items-center gap-1 sm:pr-2">
                                    <ScoreGauge value={score} size={132} />
                                    <p className="text-muted-foreground text-xs">Mandatory eligibility</p>
                                </div>
                            </div>
                        </section>

                        {/* Factors */}
                        <section className="bg-card rounded-2xl border" aria-labelledby="factors-title">
                            <div className="border-b px-5 py-4 sm:px-6">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 id="factors-title" className="font-semibold tracking-tight">
                                        What drives this
                                    </h2>
                                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                                        Guidance, not a prediction
                                    </span>
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    Worked out from the eligibility matrix and the gap plan. These indicators help you decide; they don’t predict
                                    whether you will win.
                                </p>
                            </div>
                            <ul className="divide-y">
                                {rec.factors.map((f, i) => {
                                    const t = toneIcon[f.tone];
                                    return (
                                        <li
                                            key={f.id}
                                            className="animate-fade-up flex items-start gap-3 px-5 py-4 sm:px-6"
                                            style={{ animationDelay: `${i * 50}ms` }}
                                        >
                                            <t.icon className={cn('mt-0.5 size-5 shrink-0', t.className)} aria-label={t.label} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                                    <p className="font-medium">{f.label}</p>
                                                    <p className="font-semibold tabular-nums">{f.value}</p>
                                                </div>
                                                <p className="text-muted-foreground mt-0.5 text-sm">{f.detail}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>

                        {/* Conditions */}
                        {rec.lateBlockers.length + rec.conditions.length > 0 && (
                            <section className="bg-card rounded-2xl border" aria-labelledby="conditions-title">
                                <div className="flex flex-wrap items-end justify-between gap-2 border-b px-5 py-4 sm:px-6">
                                    <div>
                                        <h2 id="conditions-title" className="font-semibold tracking-tight">
                                            Conditions for a Go
                                        </h2>
                                        <p className="text-muted-foreground text-sm">
                                            Each open mandatory gap must close by its date, or the decision is revisited.
                                        </p>
                                    </div>
                                    <Link href={route('tenders.gaps', tender.id)} className="text-primary text-sm font-medium hover:underline">
                                        Open the gap plan
                                    </Link>
                                </div>
                                <ol className="divide-y">
                                    {[...rec.lateBlockers, ...rec.conditions].map((r, i) => {
                                        const late = rec.lateBlockers.includes(r);
                                        return (
                                            <li key={r.gap!.id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                                                <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
                                                    {i + 1}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium">{r.gap!.title}</p>
                                                    <p className="text-muted-foreground text-sm">
                                                        <span className="font-mono text-xs">{r.requirement.code}</span> · {r.gap!.owner ?? 'No owner'}
                                                    </p>
                                                </div>
                                                <p
                                                    className={cn(
                                                        'shrink-0 text-right text-sm font-medium',
                                                        late ? 'text-status-not-met' : 'text-foreground',
                                                    )}
                                                >
                                                    {late ? 'Too late' : `By ${shortDate(addWorkingDays(new Date(), r.gap!.timeToCloseDays))}`}
                                                    <span className="text-muted-foreground block text-xs font-normal">
                                                        {r.gap!.status === 'in_progress' ? 'In progress' : 'Not started'}
                                                    </span>
                                                </p>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </section>
                        )}
                    </div>

                    {/* Decision panel */}
                    <aside className="lg:sticky lg:top-20">
                        {decision ? (
                            <DecisionRecord
                                outcome={decision.outcome}
                                by={decision.decidedBy}
                                at={decision.decidedAt}
                                reason={decision.reason}
                                conditions={decision.conditions ?? []}
                                canChange={isOwner(role)}
                                onChange={() => setDecision(undefined)}
                                continueHref={route('tenders.compliance', tender.id)}
                            />
                        ) : isOwner(role) ? (
                            <DecisionForm
                                verdict={rec.verdict}
                                blockers={[...rec.lateBlockers, ...rec.conditions].map((r) => ({ id: r.gap!.id, title: r.gap!.title }))}
                                tenderValue={formatMoney(tender.estimatedValue)}
                                onSubmit={(outcome, reason, acknowledged) =>
                                    setDecision({
                                        outcome,
                                        reason,
                                        acknowledgedBlockers: acknowledged,
                                        conditions:
                                            outcome === 'proceed'
                                                ? [...rec.lateBlockers, ...rec.conditions].map(
                                                      (r) => `${r.gap!.title} by ${shortDate(addWorkingDays(new Date(), r.gap!.timeToCloseDays))}`,
                                                  )
                                                : [],
                                        decidedBy: auth.user.name,
                                        decidedAt: new Date().toISOString(),
                                    })
                                }
                            />
                        ) : (
                            <div className="bg-card rounded-2xl border p-6 text-center">
                                <Lock className="text-muted-foreground mx-auto size-8" />
                                <p className="mt-3 font-medium">Waiting for an owner</p>
                                <p className="text-muted-foreground mt-1 text-sm">Only company owners can record the Go / No-Go decision.</p>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}

function DecisionForm({
    verdict,
    blockers,
    tenderValue,
    onSubmit,
}: {
    verdict: Verdict;
    blockers: { id: string; title: string }[];
    tenderValue: string;
    onSubmit: (outcome: DecisionOutcome, reason: string, acknowledged: string[]) => void;
}) {
    const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);
    const [ack, setAck] = useState<string[]>([]);
    const [reason, setReason] = useState('');

    const needsAck = outcome === 'proceed' ? blockers : [];
    const allAcked = needsAck.every((b) => ack.includes(b.id));
    const ready = outcome !== null && allAcked;
    const against = outcome !== null && ((verdict === 'no_go' && outcome === 'proceed') || (verdict === 'go' && outcome === 'decline'));

    const hint = !outcome ? 'Choose bid or don’t bid' : !allAcked ? 'Tick each open gap to accept it as a condition' : 'Ready to record';

    return (
        <section
            className="bg-card animate-fade-up rounded-2xl border p-5 shadow-[0_20px_60px_-40px_var(--glow)] sm:p-6"
            aria-labelledby="decide-title"
        >
            <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                    <Gavel className="size-4" />
                </span>
                <div>
                    <h2 id="decide-title" className="font-semibold tracking-tight">
                        Your decision
                    </h2>
                    <p className="text-muted-foreground text-xs">Contract value {tenderValue}</p>
                </div>
            </div>

            <div role="radiogroup" aria-label="Decision" className="mt-5 grid grid-cols-2 gap-2">
                <Choice
                    active={outcome === 'proceed'}
                    onClick={() => setOutcome('proceed')}
                    icon={ThumbsUp}
                    label="Bid"
                    sub="Move to compliance"
                    tone="go"
                />
                <Choice
                    active={outcome === 'decline'}
                    onClick={() => setOutcome('decline')}
                    icon={ThumbsDown}
                    label="Don’t bid"
                    sub="Archive this tender"
                    tone="no"
                />
            </div>

            {against && (
                <p className="bg-status-partial/10 text-foreground animate-fade-up mt-3 flex gap-2 rounded-lg p-3 text-xs leading-relaxed">
                    <TriangleAlert className="text-status-partial mt-px size-3.5 shrink-0" />
                    This goes against the recommendation. That’s fine — it’s your call. Adding a reason helps your team later.
                </p>
            )}

            {needsAck.length > 0 && (
                <fieldset className="animate-fade-up mt-5 space-y-2">
                    <legend className="mb-2 text-sm font-medium">Accept the open gaps as conditions</legend>
                    {needsAck.map((b) => (
                        <label
                            key={b.id}
                            className="hover:bg-muted/60 flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm transition-colors"
                        >
                            <Checkbox
                                className="mt-0.5"
                                checked={ack.includes(b.id)}
                                onCheckedChange={(v) => setAck((a) => (v === true ? [...a, b.id] : a.filter((x) => x !== b.id)))}
                            />
                            {b.title}
                        </label>
                    ))}
                </fieldset>
            )}

            <label className="mt-5 block">
                <span className="text-sm font-medium">
                    Reason <span className="text-muted-foreground font-normal">(optional)</span>
                </span>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder={
                        outcome === 'decline'
                            ? 'e.g. Turnover gap needs a partner we can’t secure before the clarification deadline.'
                            : 'e.g. Strong fit on scope; Hartwell Group agreed to a parent company guarantee.'
                    }
                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/40 mt-1.5 w-full resize-none rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2"
                />
            </label>

            <Button
                className="mt-4 h-11 w-full rounded-lg"
                disabled={!ready}
                onClick={() => outcome && onSubmit(outcome, reason.trim(), ack)}
                variant={outcome === 'decline' ? 'outline' : 'default'}
            >
                {outcome === 'decline' ? 'Record: don’t bid' : 'Record: bid'}
            </Button>
            <p className="text-muted-foreground mt-2 text-center text-xs" aria-live="polite">
                {hint}
            </p>
        </section>
    );
}

function Choice({
    active,
    onClick,
    icon: Icon,
    label,
    sub,
    tone,
}: {
    active: boolean;
    onClick: () => void;
    icon: typeof ThumbsUp;
    label: string;
    sub: string;
    tone: 'go' | 'no';
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={active}
            onClick={onClick}
            className={cn(
                'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all',
                active
                    ? tone === 'go'
                        ? 'border-status-met/50 bg-status-met/8 ring-status-met/30 ring-2'
                        : 'border-status-not-met/50 bg-status-not-met/8 ring-status-not-met/30 ring-2'
                    : 'hover:bg-muted/60',
            )}
        >
            <Icon className={cn('size-5', active ? (tone === 'go' ? 'text-status-met' : 'text-status-not-met') : 'text-muted-foreground')} />
            <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="text-muted-foreground block text-xs">{sub}</span>
            </span>
        </button>
    );
}

function DecisionRecord({
    outcome,
    by,
    at,
    reason,
    conditions,
    canChange,
    onChange,
    continueHref,
}: {
    continueHref: string;
    outcome: DecisionOutcome;
    by: string;
    at: string;
    reason: string;
    conditions: string[];
    canChange: boolean;
    onChange: () => void;
}) {
    const go = outcome === 'proceed';
    return (
        <section
            className={cn('bg-card animate-fade-up overflow-hidden rounded-2xl border', go ? 'border-status-met/35' : 'border-status-not-met/30')}
        >
            <div className={cn('flex items-center gap-3 px-5 py-4', go ? 'bg-status-met/10' : 'bg-status-not-met/10')}>
                {go ? <ShieldCheck className="text-status-met size-6" /> : <CircleX className="text-status-not-met size-6" />}
                <div>
                    <p className="font-semibold">{go ? 'Decision: bid' : 'Decision: don’t bid'}</p>
                    <p className="text-muted-foreground text-xs">
                        {by} · {formatDate(at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>
            <div className="space-y-4 p-5">
                {reason ? (
                    <blockquote className="border-primary/40 border-l-2 pl-3 text-sm leading-relaxed">{reason}</blockquote>
                ) : (
                    <p className="text-muted-foreground text-sm italic">No reason given.</p>
                )}
                {conditions.length > 0 && (
                    <div>
                        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Conditions</p>
                        <ul className="mt-2 space-y-1.5 text-sm">
                            {conditions.map((c) => (
                                <li key={c} className="flex gap-2">
                                    <CircleAlert className="text-status-partial mt-0.5 size-4 shrink-0" /> {c}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {go ? (
                    <Button asChild className="h-11 w-full rounded-lg">
                        <Link href={continueHref}>
                            Continue to compliance matrix <ArrowRight className="size-4" />
                        </Link>
                    </Button>
                ) : (
                    <Button asChild variant="outline" className="h-11 w-full rounded-lg">
                        <Link href={route('tenders.index')}>Back to tenders</Link>
                    </Button>
                )}
                {canChange && (
                    <button
                        onClick={onChange}
                        className="text-muted-foreground hover:text-foreground mx-auto flex items-center gap-1.5 text-xs transition-colors"
                    >
                        <RotateCcw className="size-3.5" /> Change decision
                    </button>
                )}
            </div>
        </section>
    );
}
