import { TenderHeader } from '@/components/ebis/tender-header';
import { TenderNotFound } from '@/components/ebis/tender-not-found';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { findTender } from '@/data/mock-ebis';
import { submissionRules } from '@/data/mock-requirements';
import { useChecklist } from '@/hooks/use-checklist';
import type { ScoreRun } from '@/hooks/use-tender-workspace';
import AppLayout from '@/layouts/app-layout';
import { checklistKindMeta, checklistKindOrder, type ResolvedItem } from '@/lib/checklist';
import { checkRules, type Contradiction, findContradictions, type RuleCheck } from '@/lib/consistency';
import { formatDate } from '@/lib/ebis';
import { type FixTarget, type Priority, priorityMeta, priorityOrder, readinessIssues, readinessScore } from '@/lib/readiness';
import { isOwner } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowDownRight,
    ArrowLeft,
    ArrowUpRight,
    BadgeCheck,
    CheckCircle2,
    CircleCheck,
    Download,
    FileArchive,
    FileCheck2,
    FileSpreadsheet,
    FileText,
    GitCompareArrows,
    Loader2,
    Lock,
    Minus,
    PartyPopper,
    PenLine,
    RefreshCw,
    RotateCcw,
    ScrollText,
    ShieldAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const fixRoute: Record<FixTarget, string> = {
    gaps: 'tenders.gaps',
    decision: 'tenders.decision',
    compliance: 'tenders.compliance',
    bid: 'tenders.bid',
    documents: 'tenders.documents',
};

export default function TenderValidation({ tenderId }: { tenderId: string }) {
    const { role, auth, tenant } = usePage<SharedData>().props;
    const tender = findTender(tenderId);
    const { rows, sections, decision, signedOff, setSignedOff, documents, scoreHistory, recordScore } = useChecklist(tenderId, tender);
    const [priority, setPriority] = useState<Priority | null>(null);

    const issues = useMemo(() => readinessIssues(rows, sections, decision, documents), [rows, sections, decision, documents]);
    const score = readinessScore(issues);
    const criticalCount = issues.filter((i) => i.priority === 'critical').length;
    const ruleChecks = useMemo(() => checkRules(submissionRules(), sections, documents), [sections, documents]);
    const contradictions = useMemo(() => findContradictions(sections), [sections]);
    const [rerunning, setRerunning] = useState(false);

    // VAL-07: every time the result changes, keep it in the history.
    useEffect(() => {
        if (tender && !signedOff) recordScore(score, criticalCount);
    }, [score, criticalCount, tender, signedOff, recordScore]);

    const rerun = () => {
        setRerunning(true);
        window.setTimeout(() => {
            recordScore(score, criticalCount, true);
            setRerunning(false);
        }, 900);
    };

    if (!tender) return <TenderNotFound />;

    const counts = Object.fromEntries(priorityOrder.map((p) => [p, issues.filter((i) => i.priority === p).length])) as Record<Priority, number>;
    const visible = priority ? issues.filter((i) => i.priority === priority) : issues;
    const companyName = (tenant as { name?: string } | null)?.name ?? 'your company';

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference, href: `/tenders/${tender.id}/eligibility` },
                { title: 'Readiness & sign-off', href: `/tenders/${tender.id}/validation` },
            ]}
        >
            <Head title={`Readiness · ${tender.reference}`} />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <TenderHeader
                    tender={tender}
                    viewing={signedOff ? 'submitted' : 'validation'}
                    actions={
                        <>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('tenders.bid', tender.id)}>
                                    <ArrowLeft className="size-4" /> Back to bid
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('tenders.documents', tender.id)}>
                                    <FileCheck2 className="size-4" /> Documents
                                </Link>
                            </Button>
                        </>
                    }
                />

                {signedOff ? (
                    <SignedOffState
                        by={signedOff.by}
                        at={signedOff.at}
                        buyer={tender.buyer.name}
                        deadline={tender.deadline}
                        canUndo={isOwner(role)}
                        onUndo={() => setSignedOff(undefined)}
                    />
                ) : (
                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                        <div className="space-y-6">
                            {/* Score */}
                            <section className="bg-card animate-fade-up relative overflow-hidden rounded-2xl border p-5 sm:p-7">
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_0%_0%,color-mix(in_oklab,var(--glow)_12%,transparent),transparent_70%)]"
                                />
                                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                                    <ReadinessRing value={score} />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <p className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">Bid readiness</p>
                                        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-balance">
                                            {counts.critical
                                                ? `${counts.critical} thing${counts.critical > 1 ? 's' : ''} would get this bid rejected`
                                                : issues.length
                                                  ? 'Nothing blocking — tidy up and sign off'
                                                  : 'Ready to sign off'}
                                        </h2>
                                        <p className="text-muted-foreground text-sm">
                                            EBIS checked the decision, every gap, the compliance matrix, the documents, the tender’s submission rules
                                            and whether your sections agree with each other.
                                        </p>
                                    </div>
                                </div>
                                <ScoreTrend history={scoreHistory} running={rerunning} onRerun={rerun} />
                                <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {priorityOrder.map((p) => {
                                        const active = priority === p;
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setPriority(active ? null : p)}
                                                aria-pressed={active}
                                                title={priorityMeta[p].hint}
                                                className={cn(
                                                    'bg-background/60 rounded-xl border p-3 text-left transition-all',
                                                    active ? 'border-primary/40 ring-primary/20 ring-2' : 'hover:bg-muted/60',
                                                )}
                                            >
                                                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                                    <span className={cn('size-2 rounded-full', priorityMeta[p].dot)} />
                                                    {priorityMeta[p].label}
                                                </span>
                                                <span className="mt-1 block text-xl font-semibold tabular-nums">{counts[p]}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Checklist */}
                            <section className="bg-card rounded-2xl border" aria-labelledby="issues-title">
                                <div className="flex items-center justify-between gap-2 border-b px-5 py-4 sm:px-6">
                                    <h2 id="issues-title" className="font-semibold tracking-tight">
                                        {priority ? `${priorityMeta[priority].label} issues` : 'Everything left to do'}
                                    </h2>
                                    <span className="text-muted-foreground text-sm tabular-nums">{visible.length}</span>
                                </div>
                                {visible.length ? (
                                    <ul className="divide-y">
                                        {visible.map((issue, i) => (
                                            <li
                                                key={issue.id}
                                                className="animate-fade-up flex items-start gap-3 px-5 py-3.5 sm:px-6"
                                                style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                                            >
                                                <span
                                                    className={cn('mt-1.5 size-2 shrink-0 rounded-full', priorityMeta[issue.priority].dot)}
                                                    aria-hidden
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm leading-relaxed">{issue.message}</p>
                                                    <p className={cn('text-xs font-medium', priorityMeta[issue.priority].text)}>
                                                        {priorityMeta[issue.priority].label}
                                                    </p>
                                                </div>
                                                <Link
                                                    href={route(fixRoute[issue.fix], tender.id)}
                                                    className="text-primary hover:bg-primary/8 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                                                >
                                                    {issue.fixLabel} <ArrowUpRight className="size-3.5" />
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 p-10 text-center">
                                        <CheckCircle2 className="text-status-met size-8" />
                                        <p className="font-medium">All clear.</p>
                                    </div>
                                )}
                            </section>

                            <ConsistencyPanel contradictions={contradictions} tenderId={tender.id} />
                            <RulesPanel checks={ruleChecks} tenderId={tender.id} />
                        </div>

                        <aside className="space-y-6 lg:sticky lg:top-20">
                            <SubmissionPack documents={documents} tenderId={tender.id} />
                            <SignOff
                                critical={counts.critical}
                                owner={isOwner(role)}
                                userName={auth.user.name}
                                companyName={companyName}
                                onSign={() => setSignedOff({ by: auth.user.name, at: new Date().toISOString() })}
                            />
                        </aside>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function ReadinessRing({ value }: { value: number }) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const tone = value >= 85 ? 'stroke-status-met' : value >= 60 ? 'stroke-status-partial' : 'stroke-status-not-met';
    return (
        <div className="relative size-[128px] shrink-0">
            <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
                <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
                <circle
                    cx="64"
                    cy="64"
                    r={r}
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    className={cn('transition-[stroke-dashoffset] duration-700', tone)}
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - value / 100)}
                />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
                <span className="text-muted-foreground text-[11px]">of 100</span>
            </span>
        </div>
    );
}

function SubmissionPack({ documents, tenderId }: { documents: ResolvedItem[]; tenderId: string }) {
    const groups = checklistKindOrder.map((kind) => {
        const all = documents.filter((d) => d.item.kind === kind && d.status !== 'not_applicable');
        const ready = all.filter((d) => d.status === 'ready').length;
        const problems = all.filter((d) => d.status === 'problem').length;
        return { kind, ready, total: all.length, problems };
    });
    const icons = { form: PenLine, bid: FileSpreadsheet, company: FileArchive, response: FileText };
    const ready = groups.reduce((t, g) => t + g.ready, 0);
    const total = groups.reduce((t, g) => t + g.total, 0);

    return (
        <section className="bg-card rounded-2xl border" aria-labelledby="pack-title">
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
                <div>
                    <h2 id="pack-title" className="font-semibold tracking-tight">
                        Submission pack
                    </h2>
                    <p className="text-muted-foreground text-xs">
                        <span className="tabular-nums">
                            {ready} of {total}
                        </span>{' '}
                        documents ready for the buyer’s portal
                    </p>
                </div>
                <Link href={route('tenders.documents', tenderId)} className="text-primary shrink-0 text-xs font-medium hover:underline">
                    Checklist
                </Link>
            </div>
            <ul className="divide-y">
                {groups.map(({ kind, ready, total, problems }) => {
                    const Icon = icons[kind];
                    return (
                        <li key={kind}>
                            <Link
                                href={route('tenders.documents', tenderId)}
                                className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors"
                            >
                                <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                                    <Icon className="text-muted-foreground size-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{checklistKindMeta[kind].label}</p>
                                    <p className={cn('text-xs', problems ? 'text-status-not-met' : 'text-muted-foreground')}>
                                        {ready} of {total} ready{problems ? ` · ${problems} problem${problems > 1 ? 's' : ''}` : ''}
                                    </p>
                                </div>
                                {ready === total ? (
                                    <CheckCircle2 className="text-status-met size-4 shrink-0" aria-label="Ready" />
                                ) : (
                                    <span className="text-muted-foreground text-[11px]">Pending</span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function SignOff({
    critical,
    owner,
    userName,
    companyName,
    onSign,
}: {
    critical: number;
    owner: boolean;
    userName: string;
    companyName: string;
    onSign: () => void;
}) {
    const [accurate, setAccurate] = useState(false);
    const [authorised, setAuthorised] = useState(false);
    const [typed, setTyped] = useState('');

    if (!owner) {
        return (
            <section className="bg-card rounded-2xl border p-6 text-center">
                <Lock className="text-muted-foreground mx-auto size-8" />
                <p className="mt-3 font-medium">Owner sign-off</p>
                <p className="text-muted-foreground mt-1 text-sm">A company owner signs off the bid before it is submitted.</p>
            </section>
        );
    }

    const blocked = critical > 0;
    const nameOk = typed.trim().toLowerCase() === userName.trim().toLowerCase();
    const ready = !blocked && accurate && authorised && nameOk;

    return (
        <section
            className={cn('bg-card rounded-2xl border p-5 sm:p-6', !blocked && 'shadow-[0_20px_60px_-40px_var(--glow)]')}
            aria-labelledby="signoff-title"
        >
            <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                    <BadgeCheck className="size-4" />
                </span>
                <h2 id="signoff-title" className="font-semibold tracking-tight">
                    Sign off
                </h2>
            </div>

            {blocked && (
                <p className="bg-status-not-met/8 mt-4 flex gap-2 rounded-lg p-3 text-xs leading-relaxed">
                    <ShieldAlert className="text-status-not-met mt-px size-3.5 shrink-0" />
                    Clear the {critical} critical issue{critical > 1 ? 's' : ''} first. Signing off a bid that would be rejected wastes everyone’s
                    time.
                </p>
            )}

            <fieldset disabled={blocked} className="mt-4 space-y-3 disabled:opacity-50">
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <Checkbox className="mt-0.5" checked={accurate} onCheckedChange={(v) => setAccurate(v === true)} disabled={blocked} />
                    The information in this bid is accurate and every claim is backed by evidence.
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <Checkbox className="mt-0.5" checked={authorised} onCheckedChange={(v) => setAuthorised(v === true)} disabled={blocked} />I am
                    authorised to submit this bid on behalf of {companyName}.
                </label>
                <label className="block">
                    <span className="text-sm font-medium">Type your full name to sign</span>
                    <Input
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        placeholder={userName}
                        className="mt-1.5 h-11 font-medium italic"
                    />
                </label>
            </fieldset>

            <Button className="mt-4 h-11 w-full rounded-lg" disabled={!ready} onClick={onSign}>
                <BadgeCheck className="size-4" /> Sign off bid
            </Button>
        </section>
    );
}

function SignedOffState({
    by,
    at,
    buyer,
    deadline,
    canUndo,
    onUndo,
}: {
    by: string;
    at: string;
    buyer: string;
    deadline: string;
    canUndo: boolean;
    onUndo: () => void;
}) {
    return (
        <section className="bg-card animate-fade-up relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border p-8 text-center sm:p-12">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,color-mix(in_oklab,var(--status-met)_16%,transparent),transparent_70%)]"
            />
            <div className="relative">
                <span className="bg-status-met/15 text-status-met mx-auto flex size-16 items-center justify-center rounded-2xl">
                    <PartyPopper className="size-8" />
                </span>
                <h2 className="mt-6 text-3xl font-semibold tracking-[-0.02em]">Bid signed off</h2>
                <p className="text-muted-foreground mx-auto mt-2 max-w-md">
                    Signed by {by} on {formatDate(at, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.
                </p>

                <ol className="mx-auto mt-8 max-w-sm space-y-3 text-left text-sm">
                    <li className="flex gap-3">
                        <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                            1
                        </span>
                        Download the submission pack.
                    </li>
                    <li className="flex gap-3">
                        <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                            2
                        </span>
                        Upload it to {buyer}’s e-tendering portal before{' '}
                        {formatDate(deadline, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.
                    </li>
                    <li className="flex gap-3">
                        <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                            3
                        </span>
                        Keep the portal’s receipt — EBIS will track the award decision.
                    </li>
                </ol>

                <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
                    <Button className="h-11 rounded-full px-6" disabled title="Arrives with the backend">
                        <Download className="size-4" /> Download submission pack
                    </Button>
                    <Button asChild variant="outline" className="h-11 rounded-full px-6">
                        <Link href={route('tenders.index')}>Back to tenders</Link>
                    </Button>
                </div>
                {canUndo && (
                    <button
                        onClick={onUndo}
                        className="text-muted-foreground hover:text-foreground mx-auto mt-6 flex items-center gap-1.5 text-xs transition-colors"
                    >
                        <RotateCcw className="size-3.5" /> Withdraw sign-off
                    </button>
                )}
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */

const shortWhen = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** VAL-07: latest and previous score, plus the run history. */
function ScoreTrend({ history, running, onRerun }: { history: ScoreRun[]; running: boolean; onRerun: () => void }) {
    const latest = history[history.length - 1];
    const previous = history[history.length - 2];
    if (!latest) return null;
    const delta = previous ? latest.score - previous.score : 0;
    const recent = history.slice(-8);
    const Arrow = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;

    return (
        <div className="bg-background/60 relative mt-6 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-5">
                <div>
                    <p className="text-muted-foreground text-[11px] font-medium">Latest</p>
                    <p className="text-lg font-semibold tabular-nums">{latest.score}</p>
                    <p className="text-muted-foreground text-[11px]">{shortWhen(latest.at)}</p>
                </div>
                {previous && (
                    <>
                        <span
                            className={cn(
                                'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                                delta > 0
                                    ? 'bg-status-met/10 text-status-met'
                                    : delta < 0
                                      ? 'bg-status-not-met/10 text-status-not-met'
                                      : 'bg-muted text-muted-foreground',
                            )}
                        >
                            <Arrow className="size-3.5" />
                            {delta > 0 ? `+${delta}` : delta}
                        </span>
                        <div>
                            <p className="text-muted-foreground text-[11px] font-medium">Previous</p>
                            <p className="text-muted-foreground text-lg font-semibold tabular-nums">{previous.score}</p>
                            <p className="text-muted-foreground text-[11px]">{shortWhen(previous.at)}</p>
                        </div>
                    </>
                )}
            </div>

            <div className="flex flex-1 items-end gap-1 sm:justify-center" aria-label="Score history" role="img">
                {recent.map((r, i) => (
                    <span
                        key={`${r.at}-${i}`}
                        title={`${r.score} · ${r.critical} critical · ${shortWhen(r.at)} · ${r.by}`}
                        className={cn('w-2.5 rounded-t-[3px]', i === recent.length - 1 ? 'bg-primary' : 'bg-muted-foreground/30')}
                        style={{ height: `${Math.max(4, (r.score / 100) * 40)}px` }}
                    />
                ))}
                <span className="text-muted-foreground ml-2 text-[11px]">
                    {history.length} check{history.length === 1 ? '' : 's'}
                </span>
            </div>

            <Button size="sm" variant="outline" onClick={onRerun} disabled={running} className="shrink-0">
                {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {running ? 'Checking…' : 'Run checks again'}
            </Button>
        </div>
    );
}

/** VAL-05: both locations of every disagreement. */
function ConsistencyPanel({ contradictions, tenderId }: { contradictions: Contradiction[]; tenderId: string }) {
    return (
        <section className="bg-card rounded-2xl border" aria-labelledby="consistency-title">
            <div className="flex items-center justify-between gap-2 border-b px-5 py-4 sm:px-6">
                <div>
                    <h2 id="consistency-title" className="flex items-center gap-2 font-semibold tracking-tight">
                        <GitCompareArrows className="text-muted-foreground size-4" /> Does your bid agree with itself?
                    </h2>
                    <p className="text-muted-foreground text-xs">Figures, names and dates compared across every section</p>
                </div>
                <span className="text-muted-foreground text-sm tabular-nums">{contradictions.length}</span>
            </div>
            {contradictions.length ? (
                <ul className="divide-y">
                    {contradictions.map((c) => (
                        <li key={c.id} className="space-y-3 px-5 py-4 sm:px-6">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium">{c.topic}</p>
                                <Link
                                    href={route('tenders.bid', tenderId)}
                                    className="text-primary hover:bg-primary/8 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                                >
                                    Fix <ArrowUpRight className="size-3.5" />
                                </Link>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {[c.a, c.b].map((m, i) => (
                                    <div key={i} className="border-status-partial/30 bg-status-partial/[0.05] rounded-lg border p-3">
                                        <p className="text-muted-foreground text-[11px] font-medium">{m.sectionTitle}</p>
                                        <p className="mt-1 text-sm">
                                            “…<mark className="bg-status-partial/20 text-foreground rounded px-0.5">{m.excerpt}</mark>…”
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-muted-foreground flex items-center gap-2 px-5 py-4 text-sm sm:px-6">
                    <CircleCheck className="text-status-met size-4" /> No contradictions found.
                </p>
            )}
        </section>
    );
}

/** VAL-03: each tender rule, with the file or section that breaks it. */
function RulesPanel({ checks, tenderId }: { checks: RuleCheck[]; tenderId: string }) {
    const breaches = checks.reduce((t, c) => t + c.breaches.length, 0);
    return (
        <section className="bg-card rounded-2xl border" aria-labelledby="rules-check-title">
            <div className="flex items-center justify-between gap-2 border-b px-5 py-4 sm:px-6">
                <div>
                    <h2 id="rules-check-title" className="flex items-center gap-2 font-semibold tracking-tight">
                        <ScrollText className="text-muted-foreground size-4" /> Tender submission rules
                    </h2>
                    <p className="text-muted-foreground text-xs">Formats, sizes, page limits and file names the buyer asked for</p>
                </div>
                <span className={cn('text-sm tabular-nums', breaches ? 'text-status-not-met font-medium' : 'text-muted-foreground')}>
                    {breaches ? `${breaches} broken` : 'All met'}
                </span>
            </div>
            <ul className="divide-y">
                {checks.map(({ rule, breaches, note }) => (
                    <li key={rule.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                        {breaches.length ? (
                            <AlertTriangleIcon />
                        ) : (
                            <CircleCheck className="text-status-met mt-0.5 size-4 shrink-0" aria-label="Met" />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm">
                                <span className="font-medium">{rule.label}:</span> {rule.value}
                            </p>
                            {breaches.length ? (
                                <ul className="mt-1 space-y-1">
                                    {breaches.map((b, i) => (
                                        <li key={i} className="text-status-not-met flex flex-wrap items-center gap-x-2 text-xs">
                                            <span className="font-medium">{b.where}</span> {b.message}
                                            <Link
                                                href={route(b.fix === 'bid' ? 'tenders.bid' : 'tenders.documents', tenderId)}
                                                className="text-primary font-medium hover:underline"
                                            >
                                                Fix
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground text-xs">{note}</p>
                            )}
                        </div>
                        <span className="text-muted-foreground shrink-0 text-[11px]">{rule.source}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function AlertTriangleIcon() {
    return <ShieldAlert className="text-status-not-met mt-0.5 size-4 shrink-0" aria-label="Broken" />;
}
