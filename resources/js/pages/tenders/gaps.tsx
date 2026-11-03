import { TenderHeader } from '@/components/ebis/tender-header';
import { TenderNotFound } from '@/components/ebis/tender-not-found';
import { GapCard } from '@/components/gaps/gap-card';
import { GapTimeline } from '@/components/gaps/gap-timeline';
import { Button } from '@/components/ui/button';
import { UploadDialog, type UploadTarget } from '@/components/vault/upload-dialog';
import { findTender } from '@/data/mock-ebis';
import { useTenderWorkspace } from '@/hooks/use-tender-workspace';
import { useVault } from '@/hooks/use-vault';
import AppLayout from '@/layouts/app-layout';
import { gapTiming, sumMoney, workingDaysBetween } from '@/lib/decision';
import { severityMeta } from '@/lib/ebis';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { expiryState } from '@/lib/vault';
import { type SharedData } from '@/types';
import type { EligibilityRow, Gap, GapSeverity } from '@/types/ebis';
import { Head, Link, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, PartyPopper, PoundSterling } from 'lucide-react';
import { useMemo, useState } from 'react';

type StatusFilter = 'active' | Gap['status'] | 'all';

const filters: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: 'To do' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'closed', label: 'Closed' },
    { value: 'all', label: 'All' },
];

const groups: { severity: GapSeverity; title: string; hint: string }[] = [
    { severity: 'blocker', title: 'Blockers', hint: 'Can’t realistically be closed before the deadline' },
    { severity: 'fixable', title: 'Fixable', hint: 'Mandatory, and can be closed in time' },
    { severity: 'minor', title: 'Minor', hint: 'Scored or informational, and can be closed in time' },
];

const gbp = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

export default function TenderGaps({ tenderId }: { tenderId: string }) {
    const { role } = usePage<SharedData>().props;
    const tender = findTender(tenderId);
    const { rows, setGapStatus } = useTenderWorkspace(tenderId);
    const { documents, missing } = useVault();
    const [upload, setUpload] = useState<{ open: boolean; target: UploadTarget }>({ open: false, target: {} });
    const [filter, setFilter] = useState<StatusFilter>('active');

    const gapRows = useMemo(() => rows.filter((r) => r.gap), [rows]);
    const workingDaysLeft = tender ? workingDaysBetween(new Date(), new Date(tender.deadline)) : 0;

    const stats = useMemo(() => {
        const open = gapRows.filter((r) => r.gap!.status !== 'closed');
        const count = (s: GapSeverity) => open.filter((r) => r.gap!.severity === s).length;
        return {
            blockers: count('blocker'),
            fixable: count('fixable'),
            minor: count('minor'),
            closed: gapRows.length - open.length,
            late: open.filter((r) => gapTiming(r.gap!, workingDaysLeft).timing === 'late').length,
            cost: sumMoney(open.map((r) => r.gap!.cost)).amount,
            total: gapRows.length,
        };
    }, [gapRows, workingDaysLeft]);

    if (!tender) return <TenderNotFound />;

    /** Which upload a gap needs: renew an expired vault file, fill a known missing item, or a fresh document. */
    const uploadTargetFor = (r: EligibilityRow): UploadTarget => {
        const ev = r.gap!.evidence!;
        const factIds = r.assessment.evidence.profileFacts.map((f) => f.id);
        const gap = { tender, gapId: r.gap!.id, code: r.requirement.code, requirementTitle: r.requirement.title, ...ev };
        if (ev.scope === 'bid') return { gap };
        const expired = documents.find((d) => d.factIds.some((id) => factIds.includes(id)) && expiryState(d).state === 'expired');
        const known = missing.find((m) => m.factId && factIds.includes(m.factId));
        return { gap, replace: expired, missing: known };
    };

    const matches = (r: EligibilityRow) => (filter === 'all' ? true : filter === 'active' ? r.gap!.status !== 'closed' : r.gap!.status === filter);
    const visible = gapRows.filter(matches);
    const progress = stats.total ? Math.round((stats.closed / stats.total) * 100) : 0;

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference, href: `/tenders/${tender.id}/eligibility` },
                { title: 'Gap analysis', href: `/tenders/${tender.id}/gaps` },
            ]}
        >
            <Head title={`Gap analysis · ${tender.reference}`} />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <TenderHeader
                    tender={tender}
                    viewing="gaps"
                    actions={
                        <>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('tenders.eligibility', tender.id)}>
                                    <ArrowLeft className="size-4" /> Eligibility
                                </Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link href={route('tenders.decision', tender.id)}>
                                    Go / No-Go <ArrowRight className="size-4" />
                                </Link>
                            </Button>
                        </>
                    }
                />

                {/* Summary */}
                <section aria-label="Gap summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Stat
                        icon={AlertTriangle}
                        tone={stats.blockers ? 'danger' : 'ok'}
                        label="Open blockers"
                        value={stats.blockers}
                        hint={stats.blockers ? 'Can’t be fixed before the deadline' : 'Everything can be fixed in time'}
                    />
                    <Stat
                        icon={CalendarClock}
                        tone={stats.late ? 'danger' : 'ok'}
                        label="Working days left"
                        value={workingDaysLeft}
                        hint={stats.late ? `${stats.late} gap${stats.late > 1 ? 's' : ''} won’t close in time` : 'Every open gap fits'}
                    />
                    <Stat
                        icon={PoundSterling}
                        tone="neutral"
                        label="Cost to close"
                        value={gbp(stats.cost)}
                        hint="Out of pocket, excluding staff time"
                    />
                    <div className="bg-card rounded-xl border p-4">
                        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                            <CheckCircle2 className="size-3.5" /> Progress
                        </p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                            {stats.closed}
                            <span className="text-muted-foreground text-base font-normal"> / {stats.total} closed</span>
                        </p>
                        <div
                            className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full"
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div className="bg-status-met h-full rounded-full transition-[width] duration-700" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                </section>

                {/* Timeline */}
                <section className="bg-card rounded-2xl border p-4 sm:p-6">
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <h2 className="font-semibold tracking-tight">Can we close everything in time?</h2>
                            <p className="text-muted-foreground text-sm">Each bar is the time a fix takes, starting today. Hover a bar for dates.</p>
                        </div>
                    </div>
                    <GapTimeline rows={gapRows} workingDaysLeft={workingDaysLeft} deadline={tender.deadline} />
                </section>

                {/* List */}
                <section className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="font-semibold tracking-tight">Action plan</h2>
                        <div
                            role="tablist"
                            aria-label="Filter gaps by status"
                            className="bg-muted/60 -mx-1 flex max-w-full overflow-x-auto rounded-lg border p-0.5 [scrollbar-width:none]"
                        >
                            {filters.map((f) => {
                                const n = gapRows.filter((r) =>
                                    f.value === 'all' ? true : f.value === 'active' ? r.gap!.status !== 'closed' : r.gap!.status === f.value,
                                ).length;
                                return (
                                    <button
                                        key={f.value}
                                        role="tab"
                                        aria-selected={filter === f.value}
                                        onClick={() => setFilter(f.value)}
                                        className={cn(
                                            'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all',
                                            filter === f.value
                                                ? 'bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {f.label}
                                        <span className="text-muted-foreground tabular-nums">{n}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {visible.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
                            <PartyPopper className="text-primary size-8" />
                            <p className="font-medium">{filter === 'active' ? 'Every gap is closed.' : 'Nothing here.'}</p>
                            <p className="text-muted-foreground text-sm">
                                {filter === 'active' ? 'You’re ready for the Go / No-Go decision.' : 'Try another filter.'}
                            </p>
                        </div>
                    ) : (
                        groups.map((g) => {
                            const items = visible.filter((r) => r.gap!.severity === g.severity);
                            if (!items.length) return null;
                            const Icon = severityMeta[g.severity].icon;
                            return (
                                <div key={g.severity} className="space-y-3">
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                                            <Icon className="size-4" /> {g.title}
                                            <span className="text-muted-foreground font-normal tabular-nums">{items.length}</span>
                                        </h3>
                                        <p className="text-muted-foreground hidden text-xs sm:block">{g.hint}</p>
                                    </div>
                                    <div className="grid gap-3 xl:grid-cols-2">
                                        {items.map((r, i) => (
                                            <GapCard
                                                key={r.gap!.id}
                                                row={r}
                                                workingDaysLeft={workingDaysLeft}
                                                canEdit={canEdit(role)}
                                                onStatusChange={(s) => setGapStatus(r.gap!.id, s)}
                                                onUpload={r.gap!.evidence ? () => setUpload({ open: true, target: uploadTargetFor(r) }) : undefined}
                                                style={{ animationDelay: `${i * 50}ms` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </section>
            </div>
            <UploadDialog open={upload.open} onOpenChange={(o) => setUpload((u) => ({ ...u, open: o }))} target={upload.target} />
        </AppLayout>
    );
}

function Stat({
    icon: Icon,
    tone,
    label,
    value,
    hint,
}: {
    icon: typeof AlertTriangle;
    tone: 'danger' | 'ok' | 'neutral';
    label: string;
    value: React.ReactNode;
    hint: string;
}) {
    return (
        <div className="bg-card rounded-xl border p-4">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                <Icon className={cn('size-3.5', tone === 'danger' && 'text-status-not-met', tone === 'ok' && 'text-status-met')} />
                {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
            <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        </div>
    );
}
