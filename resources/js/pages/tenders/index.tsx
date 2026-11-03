import { DeadlineChip } from '@/components/ebis/badges';
import { TenderDropzone } from '@/components/ebis/tender-dropzone';
import { Input } from '@/components/ui/input';
import { tenders } from '@/data/mock-ebis';
import AppLayout from '@/layouts/app-layout';
import { daysUntil, formatDate, formatMoney, stageIndex, stageRoute, stages } from '@/lib/ebis';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { Tender } from '@/types/ebis';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, Building2, LayoutGrid, List, Radio, Search, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';

type View = 'list' | 'grid';

export default function TendersIndex() {
    const { role } = usePage<SharedData>().props;
    const [view, setView] = useState<View>(() => {
        try {
            return (localStorage.getItem('tenders:view') as View) || 'list';
        } catch {
            return 'list';
        }
    });
    const [query, setQuery] = useState('');

    const changeView = (v: View) => {
        setView(v);
        try {
            localStorage.setItem('tenders:view', v);
        } catch {
            /* storage unavailable */
        }
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return [...tenders]
            .filter((t) => !q || `${t.title} ${t.reference} ${t.buyer.name} ${t.sector}`.toLowerCase().includes(q))
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    }, [query]);

    return (
        <AppLayout breadcrumbs={[{ title: 'Tenders', href: '/tenders' }]}>
            <Head title="Tenders" />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <div className="animate-fade-up flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">Tenders</h1>
                    <p className="text-muted-foreground text-sm">
                        Upload a tender pack or pick one from a public feed. EBIS Core reads it, extracts every requirement and checks your
                        eligibility.
                    </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <TenderDropzone disabled={!canEdit(role)} />
                    <div className="bg-card flex flex-col justify-between gap-4 rounded-xl border p-4 shadow-xs">
                        <div>
                            <p className="flex items-center gap-2 text-sm font-medium">
                                <Radio className="text-brand-accent size-4" /> Public feeds
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">New tenders matching your profile are pulled in daily.</p>
                        </div>
                        <ul className="space-y-2 text-sm">
                            {['Find a Tender', 'Contracts Finder', 'Public Contracts Scotland'].map((feed, i) => (
                                <li key={feed} className="flex items-center justify-between">
                                    <span>{feed}</span>
                                    <span className="text-muted-foreground text-xs tabular-nums">{[12, 7, 3][i]} new</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-semibold">
                        Active tenders <span className="text-muted-foreground font-normal tabular-nums">({filtered.length})</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 sm:w-64 sm:flex-none">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search tenders"
                                className="h-9 pl-9"
                                aria-label="Search tenders"
                            />
                        </div>
                        <div className="bg-muted/70 flex rounded-lg p-1" role="group" aria-label="View">
                            {(
                                [
                                    ['list', List],
                                    ['grid', LayoutGrid],
                                ] as const
                            ).map(([v, Icon]) => (
                                <button
                                    key={v}
                                    onClick={() => changeView(v)}
                                    aria-pressed={view === v}
                                    aria-label={`${v} view`}
                                    className={cn(
                                        'rounded-md p-1.5 transition-all',
                                        view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Icon className="size-4" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">No tenders match “{query}”.</div>
                ) : view === 'list' ? (
                    <div className="bg-card divide-y overflow-hidden rounded-xl border shadow-xs">
                        {filtered.map((t, i) => (
                            <TenderListItem key={t.id} tender={t} index={i} />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((t, i) => (
                            <TenderCard key={t.id} tender={t} index={i} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function StageProgress({ tender }: { tender: Tender }) {
    const idx = stageIndex(tender.stage);
    return (
        <div className="flex items-center gap-2">
            <div className="flex gap-0.5" aria-hidden>
                {stages.map((s, i) => (
                    <span
                        key={s.id}
                        className={cn('h-1.5 w-2.5 rounded-full', i < idx ? 'bg-primary' : i === idx ? 'bg-brand-accent' : 'bg-muted')}
                    />
                ))}
            </div>
            <span className="text-muted-foreground text-xs">{stages[idx].label}</span>
        </div>
    );
}

function Score({ value }: { value?: number }) {
    if (value === undefined) return <span className="text-muted-foreground text-xs">Not assessed</span>;
    const tone = value >= 85 ? 'text-status-met' : value >= 60 ? 'text-status-partial' : 'text-status-not-met';
    return (
        <span className="text-xs">
            <span className={cn('font-semibold tabular-nums', tone)}>{value}</span>
            <span className="text-muted-foreground"> eligibility</span>
        </span>
    );
}

function TenderListItem({ tender: t, index }: { tender: Tender; index: number }) {
    return (
        <Link
            href={route(stageRoute(t.stage), t.id)}
            style={{ animationDelay: `${index * 40}ms` }}
            className="group hover:bg-accent/40 animate-fade-up grid gap-3 px-4 py-4 transition-colors sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
        >
            <div className="min-w-0">
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-mono">{t.reference}</span>
                    <span className="flex items-center gap-1">
                        <Building2 className="size-3.5" /> {t.buyer.name}
                    </span>
                    <span className="flex items-center gap-1">
                        {t.source.kind === 'upload' ? <Upload className="size-3.5" /> : <Radio className="size-3.5" />}
                        {t.source.kind === 'upload' ? 'Uploaded' : t.source.feed}
                    </span>
                </div>
                <p className="group-hover:text-primary mt-1 leading-snug font-medium transition-colors">{t.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <StageProgress tender={t} />
                    <Score value={t.eligibilityScore} />
                </div>
            </div>
            <div className="flex items-center gap-4 md:flex-col md:items-end md:gap-1.5">
                <span className="text-sm font-semibold tabular-nums">{formatMoney(t.estimatedValue)}</span>
                <span className="text-muted-foreground text-xs">Due {formatDate(t.deadline)}</span>
                <DeadlineChip days={daysUntil(t.deadline)} />
            </div>
        </Link>
    );
}

function TenderCard({ tender: t, index }: { tender: Tender; index: number }) {
    return (
        <Link
            href={route(stageRoute(t.stage), t.id)}
            style={{ animationDelay: `${index * 40}ms` }}
            className="group bg-card hover:border-primary/30 animate-fade-up flex flex-col gap-3 rounded-xl border p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
            <div className="flex items-start justify-between gap-2">
                <span className="text-muted-foreground font-mono text-xs">{t.reference}</span>
                <ArrowUpRight className="text-muted-foreground group-hover:text-primary size-4 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            <p className="line-clamp-2 leading-snug font-medium">{t.title}</p>
            <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                <Building2 className="size-3.5 shrink-0" /> {t.buyer.name}
            </p>
            <div className="mt-auto space-y-3 border-t pt-3">
                <StageProgress tender={t} />
                <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(t.estimatedValue)}</span>
                    <DeadlineChip days={daysUntil(t.deadline)} />
                </div>
                <Score value={t.eligibilityScore} />
            </div>
        </Link>
    );
}
