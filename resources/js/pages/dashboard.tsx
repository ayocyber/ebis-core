import { ResultsChart } from '@/components/dashboard/results-chart';
import { DeadlineChip } from '@/components/ebis/badges';
import { Button } from '@/components/ui/button';
import { results } from '@/data/mock-dashboard';
import { tenders } from '@/data/mock-ebis';
import { useAudit } from '@/hooks/use-audit';
import { useWorkspaces } from '@/hooks/use-tender-workspace';
import { useVault } from '@/hooks/use-vault';
import AppLayout from '@/layouts/app-layout';
import { attentionItems, attentionMeta, greeting, isAssessed, isDrafting, openGaps, tenderReadiness } from '@/lib/dashboard';
import { daysUntil, formatDate, formatMoney, stageIndex, stageRoute, stages } from '@/lib/ebis';
import { canEdit, isOwner } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { expiryState } from '@/lib/vault';
import { type BreadcrumbItem, type SharedData } from '@/types';
import type { Tender, VaultDocument } from '@/types/ebis';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, ArrowUpRight, CalendarClock, CheckCircle2, FileStack, Flag, Layers, ShieldAlert, Trophy, Upload, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

const gbp = (amount: number) => formatMoney({ amount, currency: 'GBP' });

export default function Dashboard() {
    const { tenant, role, auth } = usePage<SharedData>().props;
    const now = useMemo(() => new Date(), []);
    const [showAll, setShowAll] = useState(false);

    const live = useMemo(() => tenders.filter((t) => t.stage !== 'submitted').sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline)), []);
    const views = useWorkspaces(live.map((t) => t.id));
    const vault = useVault();
    const activity = useAudit().slice(0, 5);

    const items = attentionItems(live, views, vault.documents, vault.missing, now);
    const shown = showAll ? items : items.slice(0, 5);

    // KPIs
    const pipeline = live.reduce((s, t) => s + (t.estimatedValue?.amount ?? 0), 0);
    const next = live.find((t) => daysUntil(t.deadline, now) >= 0);
    const gapRows = live.filter(isAssessed).flatMap((t) => openGaps(views[t.id]));
    const blockers = gapRows.filter((r) => r.gap!.severity === 'blocker').length;
    const expiry = vault.documents.map((d) => expiryState(d, now).state);
    const expired = expiry.filter((s) => s === 'expired').length;
    const expiring = expiry.filter((s) => s === 'expiring').length;

    const won = results.reduce((s, r) => s + r.won, 0);
    const decided = results.reduce((s, r) => s + r.won + r.lost, 0);
    const wonValue = results.reduce((s, r) => s + r.wonValue, 0);

    const firstName = auth.user.name.split(' ')[0];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                {/* Header */}
                <div className="animate-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-muted-foreground text-sm">
                            {tenant?.name} · {formatDate(now.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
                            {greeting(now)}, {firstName}
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {items.filter((i) => i.tone === 'critical').length
                                ? `${items.filter((i) => i.tone === 'critical').length} things need you today.`
                                : 'Nothing urgent today.'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {isOwner(role) && (
                            <Button asChild variant="outline">
                                <Link href={route('members.index')}>
                                    <UserPlus className="size-4" /> Invite
                                </Link>
                            </Button>
                        )}
                        {canEdit(role) && (
                            <Button asChild className="shadow-[0_10px_28px_-12px_var(--glow)]">
                                <Link href={route('tenders.index')}>
                                    <Upload className="size-4" /> Upload a tender
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>

                {/* KPIs */}
                <div className="animate-fade-up grid grid-cols-2 gap-3 [animation-delay:60ms] lg:grid-cols-4">
                    <Kpi
                        href={route('tenders.index')}
                        icon={Layers}
                        label="Live bids"
                        value={String(live.length)}
                        sub={`${gbp(pipeline)} in the pipeline`}
                    />
                    <Kpi
                        href={next ? route(stageRoute(next.stage), { tender: next.id }) : route('tenders.index')}
                        icon={CalendarClock}
                        label="Next deadline"
                        value={next ? `${daysUntil(next.deadline, now)} days` : '—'}
                        sub={next ? next.buyer.name : 'No open deadlines'}
                        tone={next && daysUntil(next.deadline, now) <= 7 ? 'critical' : undefined}
                    />
                    <Kpi
                        href={route('tenders.index')}
                        icon={Flag}
                        label="Open gaps"
                        value={String(gapRows.length)}
                        sub={blockers ? `${blockers} blocker${blockers > 1 ? 's' : ''} across your bids` : 'No blockers'}
                        tone={blockers ? 'warning' : undefined}
                    />
                    <Kpi
                        href={route('vault.index')}
                        icon={FileStack}
                        label="Evidence vault"
                        value={`${vault.documents.length} docs`}
                        sub={expired || expiring ? `${expired} expired · ${expiring} expiring soon` : 'All up to date'}
                        tone={expired ? 'critical' : expiring ? 'warning' : undefined}
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
                    <div className="min-w-0 space-y-6">
                        {/* Attention */}
                        <section aria-labelledby="attention-title" className="bg-card animate-fade-up rounded-2xl border [animation-delay:120ms]">
                            <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
                                <div>
                                    <h2 id="attention-title" className="font-semibold tracking-tight">
                                        Needs your attention
                                    </h2>
                                    <p className="text-muted-foreground text-xs">Across every live bid and your evidence vault</p>
                                </div>
                                <span className="bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums">{items.length}</span>
                            </header>
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                                    <CheckCircle2 className="text-status-met size-8" />
                                    <p className="font-medium">You’re all caught up</p>
                                    <p className="text-muted-foreground text-sm">EBIS will flag anything new here.</p>
                                </div>
                            ) : (
                                <ul className="divide-y">
                                    {shown.map((item) => {
                                        const meta = attentionMeta[item.tone];
                                        return (
                                            <li key={item.id}>
                                                <Link
                                                    href={item.href}
                                                    className="group hover:bg-muted/40 flex items-start gap-3 px-5 py-3.5 transition-colors"
                                                >
                                                    <span className="mt-1.5 flex w-14 shrink-0 items-center gap-1.5">
                                                        <span className={cn('size-2 rounded-full', meta.dot)} />
                                                        <span className={cn('text-[11px] font-semibold', meta.text)}>{meta.label}</span>
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-medium">{item.title}</span>
                                                        <span className="text-muted-foreground line-clamp-1 text-xs">{item.detail}</span>
                                                    </span>
                                                    <span className="text-primary mt-0.5 hidden shrink-0 items-center gap-1 text-xs font-medium sm:flex">
                                                        {item.action}
                                                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {items.length > 5 && (
                                <div className="border-t px-5 py-2.5">
                                    <button
                                        onClick={() => setShowAll((s) => !s)}
                                        className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
                                    >
                                        {showAll ? 'Show fewer' : `Show all ${items.length}`}
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* Pipeline */}
                        <section aria-labelledby="bids-title" className="bg-card animate-fade-up rounded-2xl border [animation-delay:180ms]">
                            <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
                                <div>
                                    <h2 id="bids-title" className="font-semibold tracking-tight">
                                        Your bids
                                    </h2>
                                    <p className="text-muted-foreground text-xs">Soonest deadline first</p>
                                </div>
                                <Link
                                    href={route('tenders.index')}
                                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium transition-colors"
                                >
                                    All tenders <ArrowUpRight className="size-3.5" />
                                </Link>
                            </header>
                            <ul className="divide-y">
                                {live.map((t) => (
                                    <BidRow key={t.id} tender={t} status={bidStatus(t, views[t.id], vault.documents)} now={now} />
                                ))}
                            </ul>
                        </section>
                    </div>

                    {/* Right column */}
                    <div className="space-y-6">
                        <section aria-labelledby="dates-title" className="bg-card animate-fade-up rounded-2xl border p-5 [animation-delay:140ms]">
                            <h2 id="dates-title" className="mb-4 font-semibold tracking-tight">
                                Key dates
                            </h2>
                            <KeyDates tenders={live} now={now} />
                        </section>

                        <section aria-labelledby="results-title" className="bg-card animate-fade-up rounded-2xl border p-5 [animation-delay:200ms]">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h2 id="results-title" className="font-semibold tracking-tight">
                                        Results
                                    </h2>
                                    <p className="text-muted-foreground text-xs">Last 4 quarters</p>
                                </div>
                                <Trophy className="text-muted-foreground size-4" />
                            </div>
                            <div className="mb-5 grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-2xl font-semibold tracking-tight tabular-nums">{Math.round((won / decided) * 100)}%</p>
                                    <p className="text-muted-foreground text-xs">
                                        Win rate · {won} of {decided}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-2xl font-semibold tracking-tight tabular-nums">{gbp(wonValue)}</p>
                                    <p className="text-muted-foreground text-xs">Contract value won</p>
                                </div>
                            </div>
                            <ResultsChart data={results} />
                        </section>

                        <section aria-labelledby="activity-title" className="bg-card animate-fade-up rounded-2xl border p-5 [animation-delay:260ms]">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h2 id="activity-title" className="font-semibold tracking-tight">
                                    Recent activity
                                </h2>
                                <Link
                                    href={route('activity.index')}
                                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium transition-colors"
                                >
                                    Audit log <ArrowUpRight className="size-3.5" />
                                </Link>
                            </div>
                            <ol className="relative space-y-4">
                                <span className="bg-border absolute top-2 bottom-2 left-[13px] w-px" aria-hidden />
                                {activity.map((a) => {
                                    const body = (
                                        <>
                                            <span className="font-medium">{a.by}</span> {a.action}{' '}
                                            <span className="text-foreground font-medium">{a.target}</span>
                                        </>
                                    );
                                    return (
                                        <li key={a.id} className="relative flex gap-3">
                                            <span
                                                className={cn(
                                                    'ring-card relative flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-4',
                                                    a.by === 'EBIS' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                                                )}
                                            >
                                                {a.by
                                                    .split(' ')
                                                    .map((p) => p[0])
                                                    .slice(0, 2)
                                                    .join('')}
                                            </span>
                                            <div className="min-w-0 text-sm">
                                                <p className="text-muted-foreground leading-snug">
                                                    <Link
                                                        href={route('activity.index', a.tenderId ? { tender: a.tenderId } : undefined)}
                                                        className="hover:text-foreground transition-colors"
                                                    >
                                                        {body}
                                                    </Link>
                                                </p>
                                                <p className="text-muted-foreground/80 mt-0.5 text-xs">{timeAgo(a.at, now)}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

/* ------------------------------------------------------------------ */

type Tone = 'critical' | 'warning' | undefined;

function Kpi({
    href,
    icon: Icon,
    label,
    value,
    sub,
    tone,
}: {
    href: string;
    icon: typeof Layers;
    label: string;
    value: string;
    sub: string;
    tone?: Tone;
}) {
    return (
        <Link
            href={href}
            className="group bg-card hover:border-primary/30 relative overflow-hidden rounded-2xl border p-4 transition-all hover:shadow-[0_16px_40px_-28px_var(--glow)] sm:p-5"
        >
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs font-medium">{label}</p>
                <Icon className="text-muted-foreground group-hover:text-primary size-4 transition-colors" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
            <p
                className={cn(
                    'mt-1 flex items-center gap-1 truncate text-xs',
                    tone === 'critical' ? 'text-status-not-met' : tone === 'warning' ? 'text-status-partial' : 'text-muted-foreground',
                )}
            >
                {tone && <ShieldAlert className="size-3.5 shrink-0" />}
                <span className="truncate">{sub}</span>
            </p>
        </Link>
    );
}

interface BidStatus {
    label: string;
    value?: number;
    tone: 'good' | 'warn' | 'bad' | 'neutral';
}

function bidStatus(t: Tender, view: ReturnType<typeof useWorkspaces>[string], documents: VaultDocument[]): BidStatus {
    if (view.signedOff) return { label: 'Signed off', tone: 'good' };
    if (isDrafting(t)) {
        const score = tenderReadiness(view, t, documents);
        return { label: `${score}% ready`, value: score, tone: score >= 80 ? 'good' : score >= 50 ? 'warn' : 'bad' };
    }
    if (isAssessed(t)) {
        const gaps = openGaps(view);
        const blockers = gaps.filter((r) => r.gap!.severity === 'blocker').length;
        if (!gaps.length) return { label: 'No open gaps', tone: 'good' };
        return {
            label: `${gaps.length} gaps${blockers ? ` · ${blockers} blocker${blockers > 1 ? 's' : ''}` : ''}`,
            tone: blockers ? 'bad' : 'warn',
        };
    }
    if (t.stage === 'requirements') return { label: 'Check requirements', tone: 'neutral' };
    return { label: 'EBIS is reading the pack', tone: 'neutral' };
}

const toneText = { good: 'text-status-met', warn: 'text-status-partial', bad: 'text-status-not-met', neutral: 'text-muted-foreground' };

function BidRow({ tender: t, status, now }: { tender: Tender; status: BidStatus; now: Date }) {
    const idx = stageIndex(t.stage);
    return (
        <li>
            <Link
                href={route(stageRoute(t.stage), { tender: t.id })}
                className="group hover:bg-muted/40 grid gap-3 px-5 py-4 transition-colors md:grid-cols-[minmax(0,1fr)_200px_120px] md:items-center xl:grid-cols-[minmax(0,1fr)_260px_130px]"
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{t.buyer.name}</p>
                        <span className="text-muted-foreground shrink-0 font-mono text-[11px]">{t.reference}</span>
                    </div>
                    <p className="text-muted-foreground truncate text-xs">{t.title}</p>
                </div>

                <div>
                    <div className="flex gap-0.5" aria-hidden>
                        {stages.map((s, i) => (
                            <span
                                key={s.id}
                                className={cn('h-1.5 flex-1 rounded-full', i < idx ? 'bg-primary' : i === idx ? 'bg-primary/50' : 'bg-muted')}
                            />
                        ))}
                    </div>
                    <p className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">{stages[idx]?.label}</span>
                        <span className={cn('font-medium', toneText[status.tone])}>{status.label}</span>
                    </p>
                    <span className="sr-only">
                        Stage {idx + 1} of {stages.length}: {stages[idx]?.label}. {status.label}.
                    </span>
                </div>

                <div className="flex items-center justify-between gap-2 md:flex-col md:items-end">
                    <DeadlineChip days={daysUntil(t.deadline, now)} />
                    <span className="text-muted-foreground flex items-center gap-2 text-xs">
                        <span className="tabular-nums">{formatMoney(t.estimatedValue)}</span>
                        <span
                            className="bg-muted text-foreground flex size-5 items-center justify-center rounded-full text-[9px] font-semibold"
                            title={t.owner.name}
                        >
                            {t.owner.initials}
                        </span>
                    </span>
                </div>
            </Link>
        </li>
    );
}

function KeyDates({ tenders: list, now }: { tenders: Tender[]; now: Date }) {
    const dates = list
        .flatMap((t) => [
            { t, at: t.deadline, label: 'Submission deadline' },
            ...(t.clarificationDeadline ? [{ t, at: t.clarificationDeadline, label: 'Clarification questions close' }] : []),
        ])
        .filter((d) => daysUntil(d.at, now) >= 0)
        .sort((a, b) => +new Date(a.at) - +new Date(b.at))
        .slice(0, 5);

    if (!dates.length) return <p className="text-muted-foreground text-sm">No upcoming dates.</p>;

    return (
        <ul className="space-y-3">
            {dates.map((d) => {
                const days = daysUntil(d.at, now);
                return (
                    <li key={`${d.t.id}-${d.label}`}>
                        <Link href={route(stageRoute(d.t.stage), { tender: d.t.id })} className="group flex items-center gap-3">
                            <span
                                className={cn(
                                    'flex w-11 shrink-0 flex-col items-center rounded-lg border py-1 leading-none',
                                    days <= 7 && 'border-status-not-met/40 bg-status-not-met/[0.06]',
                                )}
                            >
                                <span className="text-muted-foreground text-[10px] font-medium uppercase">
                                    {formatDate(d.at, { month: 'short' })}
                                </span>
                                <span className="mt-0.5 text-base font-semibold tabular-nums">{formatDate(d.at, { day: 'numeric' })}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="group-hover:text-primary block truncate text-sm font-medium transition-colors">
                                    {d.t.buyer.name}
                                </span>
                                <span className="text-muted-foreground block truncate text-xs">
                                    {d.label} · {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
                                </span>
                            </span>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}

function timeAgo(iso: string, now: Date): string {
    const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
    const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
    if (mins < 60) return rtf.format(-Math.max(1, mins), 'minute');
    const hours = Math.round(mins / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    return rtf.format(-Math.round(hours / 24), 'day');
}
