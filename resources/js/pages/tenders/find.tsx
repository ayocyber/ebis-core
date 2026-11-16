import { DeadlineChip } from '@/components/ebis/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { daysUntil, formatDate, formatMoney } from '@/lib/ebis';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowRight, Building2, ChevronDown, ExternalLink, FileText, Loader2, MapPin, Plus, Radio, Search, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

interface Opportunity {
    id: string;
    source: string;
    noticeId: string;
    title: string;
    summary: string;
    buyer: { name: string; type: string };
    value: number | null;
    currency: string;
    deadline: string;
    publishedAt: string | null;
    category: string | null;
    regions: string[];
    sme: boolean | null;
    url: string;
    portalUrl: string | null;
    documents: number;
    awardCriteria: { name: string; type: string; weight: number | null }[];
    selection: string[];
    matched: string[];
    tenderId: string | null;
}

interface Filters {
    q?: string;
    region?: string;
    min?: number;
    max?: number;
    days?: number;
    sme?: boolean | string;
    all?: boolean | string;
    sort?: string;
    page?: number;
}

interface Props {
    results: Opportunity[];
    total: number;
    page: number;
    pages: number;
    filters: Filters;
    keywords: string[];
    keywordsAreDefault: boolean;
    openCount: number;
    fetchedAt: string | null;
    fetching: boolean;
}

const REGIONS = [
    'London',
    'South East',
    'South West',
    'East of England',
    'East Midlands',
    'West Midlands',
    'Yorkshire and the Humber',
    'North West',
    'North East',
    'Scotland',
    'Wales',
    'Northern Ireland',
];

const BUYER_TYPES: Record<string, string> = {
    central: 'Central government',
    local: 'Local authority',
    nhs: 'NHS / health',
    education: 'Education',
    devolved: 'Devolved government',
    private: 'Utility or private',
    international: 'International',
};

const ANY = 'any';

/** Common starting points; the user adds and saves the ones that fit. */
const SUGGESTIONS = ['network', 'Wi-Fi', 'IT support', 'software', 'cyber', 'cleaning', 'construction', 'consultancy', 'training'];
const on = (v: unknown) => v === true || v === '1' || v === 'true';

function ago(iso: string): string {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} minutes ago`;
    const hours = Math.round(mins / 60);
    return hours < 48 ? `${hours} hour${hours > 1 ? 's' : ''} ago` : formatDate(iso);
}

export default function FindTenders(props: Props) {
    const { results, total, page, pages, filters, openCount, fetchedAt, fetching } = props;
    const { role } = usePage<SharedData>().props;
    const [q, setQ] = useState(filters.q ?? '');
    const showAll = on(filters.all);
    // Every open tender is listed: "show all", or no search words set yet.
    const noWords = !filters.q && (showAll || props.keywords.length === 0);

    const go = (patch: Partial<Filters>) => {
        const next: Record<string, unknown> = { ...filters, page: undefined, ...patch };
        for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '' || next[k] === false || next[k] === ANY) delete next[k];
        router.get(route('opportunities.index'), next as Record<string, string>, { preserveState: true, preserveScroll: true });
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: 'Find tenders', href: '/tenders/find' },
            ]}
        >
            <Head title="Find tenders" />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <div className="animate-fade-up flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">Find tenders</h1>
                    <p className="text-muted-foreground text-sm">
                        Open UK public-sector tenders from Find a Tender and Contracts Finder, matched to your company. Pick one and ProcurPilot reads
                        its requirements and checks them against your vault.
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Radio className="text-brand-accent size-3.5" />
                        {openCount.toLocaleString()} open tenders
                        {fetchedAt ? ` · updated ${ago(fetchedAt)}` : ''}
                        {fetching && (
                            <span className="flex items-center gap-1">
                                · <Loader2 className="size-3 animate-spin" /> checking for new ones
                            </span>
                        )}
                    </p>
                </div>

                <KeywordEditor key={props.keywords.join('|')} {...props} editable={canEdit(role)} />

                {/* Filters */}
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <form
                        className="relative flex-1"
                        onSubmit={(e) => {
                            e.preventDefault();
                            go({ q: q.trim() || undefined });
                        }}
                    >
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search for something else, e.g. cleaning, CCTV, payroll"
                            className="h-9 pl-9"
                            aria-label="Search tenders"
                        />
                    </form>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                        <FilterSelect
                            label="Region"
                            value={filters.region ?? ANY}
                            onChange={(v) => go({ region: v })}
                            options={[[ANY, 'Anywhere'], ...REGIONS.map((r) => [r, r] as [string, string])]}
                        />
                        <FilterSelect
                            label="Closing"
                            value={String(filters.days ?? ANY)}
                            onChange={(v) => go({ days: v === ANY ? undefined : Number(v) })}
                            options={[
                                [ANY, 'Any deadline'],
                                ['14', 'Within 2 weeks'],
                                ['30', 'Within a month'],
                                ['60', 'Within 2 months'],
                            ]}
                        />
                        <FilterSelect
                            label="Value"
                            value={filters.max ? `max:${filters.max}` : filters.min ? `min:${filters.min}` : ANY}
                            onChange={(v) => {
                                const [k, n] = v.split(':');
                                go({ min: k === 'min' ? Number(n) : undefined, max: k === 'max' ? Number(n) : undefined });
                            }}
                            options={[
                                [ANY, 'Any value'],
                                ['max:100000', 'Up to £100k'],
                                ['max:1000000', 'Up to £1m'],
                                ['min:100000', '£100k and over'],
                                ['min:1000000', '£1m and over'],
                            ]}
                        />
                        <FilterSelect
                            label="Sort"
                            value={filters.sort ?? (noWords ? 'newest' : 'match')}
                            onChange={(v) => go({ sort: v === 'match' ? undefined : v })}
                            options={[
                                ['match', 'Best match'],
                                ['closing', 'Closing soonest'],
                                ['newest', 'Newest'],
                                ['value', 'Highest value'],
                            ]}
                        />
                        <label className="bg-card col-span-2 flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm sm:col-span-1">
                            <input type="checkbox" checked={on(filters.sme)} onChange={(e) => go({ sme: e.target.checked || undefined })} />
                            Marked suitable for SMEs
                        </label>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="text-muted-foreground">
                        <span className="text-foreground font-semibold tabular-nums">{total}</span>{' '}
                        {filters.q ? `match “${filters.q}”` : noWords ? 'open tenders' : 'match your search words'}
                    </p>
                    {(filters.q || (showAll && props.keywords.length > 0)) && (
                        <button
                            className="text-primary text-xs font-medium hover:underline"
                            onClick={() => (setQ(''), go({ q: undefined, all: undefined }))}
                        >
                            Back to tenders matching your search words
                        </button>
                    )}
                    {!filters.q && !noWords && (
                        <button className="text-primary text-xs font-medium hover:underline" onClick={() => go({ all: true })}>
                            Show all open tenders
                        </button>
                    )}
                </div>

                {results.length === 0 ? (
                    <div className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
                        {openCount === 0 ? (
                            <>
                                <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                                Fetching tenders from the government feeds. Refresh this page in a minute.
                            </>
                        ) : (
                            <>No open tenders match. Try fewer filters, other search words, or show all open tenders.</>
                        )}
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {results.map((o, i) => (
                            <OpportunityCard key={o.id} o={o} index={i} editable={canEdit(role)} />
                        ))}
                    </ul>
                )}

                {pages > 1 && (
                    <nav className="flex items-center justify-center gap-2" aria-label="Pages">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go({ ...filters, page: page - 1 })}>
                            Previous
                        </Button>
                        <span className="text-muted-foreground text-sm tabular-nums">
                            Page {page} of {pages}
                        </span>
                        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => go({ ...filters, page: page + 1 })}>
                            Next
                        </Button>
                    </nav>
                )}
            </div>
        </AppLayout>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: [string, string][];
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-9 sm:w-auto sm:min-w-36" aria-label={label}>
                {/* The label is given explicitly so it shows before the list is first opened. */}
                <SelectValue>{options.find(([v]) => v === value)?.[1]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
                {options.map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                        {l}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/** The company's search words: what "matching your company" means, and editable. */
function KeywordEditor({ keywords, keywordsAreDefault, editable }: Props & { editable: boolean }) {
    const [words, setWords] = useState(keywords);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState<string | null>(null);
    const changed = words.join('|') !== keywords.join('|');

    const add = () => {
        const w = draft.trim();
        if (w.length < 3) return setError('Use at least 3 letters, e.g. “network” or “IT support”.');
        if (!words.some((x) => x.toLowerCase() === w.toLowerCase())) setWords([...words, w]);
        setDraft('');
        setError(null);
    };

    return (
        <section className="bg-card animate-fade-up rounded-xl border p-4 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="text-primary size-4" /> Your search words
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        {keywords.length === 0 && keywordsAreDefault
                            ? 'Add words for what your company does, so the tenders that fit you are shown first. Your company profile has no sector yet to suggest them from.'
                            : keywordsAreDefault
                              ? 'Suggested from the sector in your company profile. Change them to what you actually do.'
                              : 'Only tenders that mention these in their title, category or description are shown.'}
                    </p>
                </div>
                {changed && editable && (
                    <Button
                        size="sm"
                        onClick={() =>
                            router.put(
                                route('opportunities.keywords'),
                                { keywords: words },
                                { preserveScroll: true, onError: (e) => setError(Object.values(e)[0] ?? null) },
                            )
                        }
                    >
                        Save and search
                    </Button>
                )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                {words.length === 0 && <span className="text-muted-foreground text-xs">No search words: every open tender is shown.</span>}
                {words.map((w) => (
                    <span
                        key={w}
                        className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full py-1 pr-1.5 pl-3 text-xs font-medium"
                    >
                        {w}
                        {editable && (
                            <button
                                onClick={() => setWords(words.filter((x) => x !== w))}
                                aria-label={`Remove ${w}`}
                                className="hover:bg-primary/15 rounded-full p-0.5"
                            >
                                <X className="size-3" />
                            </button>
                        )}
                    </span>
                ))}
                {editable && (
                    <form
                        className="flex items-center gap-1"
                        onSubmit={(e) => {
                            e.preventDefault();
                            add();
                        }}
                    >
                        <Input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Add a word"
                            className="h-7 w-32 text-xs"
                            aria-label="Add a search word"
                        />
                        <Button type="submit" size="icon" variant="ghost" className="size-7" aria-label="Add">
                            <Plus className="size-4" />
                        </Button>
                    </form>
                )}
            </div>
            {editable && words.length < 3 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Try:</span>
                    {SUGGESTIONS.filter((s) => !words.some((w) => w.toLowerCase() === s.toLowerCase())).map((s) => (
                        <button
                            key={s}
                            onClick={() => setWords([...words, s])}
                            className="hover:border-primary/40 hover:text-primary rounded-full border border-dashed px-2.5 py-0.5 transition-colors"
                        >
                            + {s}
                        </button>
                    ))}
                </div>
            )}
            {error && (
                <p role="alert" className="text-status-not-met mt-2 text-xs">
                    {error}
                </p>
            )}
        </section>
    );
}

function OpportunityCard({ o, index, editable }: { o: Opportunity; index: number; editable: boolean }) {
    const [open, setOpen] = useState(false);
    const [starting, setStarting] = useState(false);
    const asks = o.selection.length + o.awardCriteria.length;

    return (
        <li style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }} className="bg-card animate-fade-up rounded-xl border p-4 shadow-xs sm:p-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0 space-y-2">
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="bg-muted rounded-full px-2 py-0.5 font-medium">{o.source}</span>
                        <span className="flex min-w-0 items-center gap-1">
                            <Building2 className="size-3.5 shrink-0" /> <span className="truncate">{o.buyer.name}</span>
                        </span>
                        <span>{BUYER_TYPES[o.buyer.type] ?? o.buyer.type}</span>
                        {o.regions.length > 0 && (
                            <span className="flex items-center gap-1">
                                <MapPin className="size-3.5" /> {o.regions.slice(0, 2).join(', ')}
                                {o.regions.length > 2 ? ` +${o.regions.length - 2}` : ''}
                            </span>
                        )}
                    </div>
                    <p className="leading-snug font-medium">{o.title}</p>
                    {o.summary && <p className="text-muted-foreground line-clamp-3 text-sm">{o.summary}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {o.matched.map((m) => (
                            <span key={m} className="bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                                matches “{m}”
                            </span>
                        ))}
                        {o.category && <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5">{o.category}</span>}
                        {o.sme && <span className="bg-status-met/10 text-status-met rounded-full px-2 py-0.5 font-medium">Suitable for SMEs</span>}
                        {o.documents > 0 && (
                            <span className="bg-muted text-muted-foreground flex items-center gap-1 rounded-full px-2 py-0.5">
                                <FileText className="size-3" /> {o.documents} document{o.documents > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2 md:flex-col md:items-end md:gap-1.5">
                    <span className="text-sm font-semibold tabular-nums">
                        {o.value ? (
                            formatMoney({ amount: o.value, currency: 'GBP' })
                        ) : (
                            <span className="text-muted-foreground font-normal">Value not given</span>
                        )}
                    </span>
                    <span className="text-muted-foreground text-xs">Closes {formatDate(o.deadline)}</span>
                    <DeadlineChip days={daysUntil(o.deadline)} />
                </div>
            </div>

            {open && asks > 0 && (
                <div className="bg-muted/40 mt-4 grid gap-4 rounded-lg p-3 text-sm sm:grid-cols-2">
                    {o.selection.length > 0 && (
                        <div>
                            <p className="mb-1 text-xs font-semibold">What suppliers must show</p>
                            <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs">
                                {o.selection.map((s, i) => (
                                    <li key={i} className="whitespace-pre-line">
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {o.awardCriteria.length > 0 && (
                        <div>
                            <p className="mb-1 text-xs font-semibold">How bids are scored</p>
                            <ul className="space-y-1 text-xs">
                                {o.awardCriteria.map((c) => (
                                    <li key={c.name} className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">{c.name}</span>
                                        {c.weight !== null && <span className="font-medium tabular-nums">{c.weight}%</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                {o.tenderId ? (
                    <Button size="sm" variant="outline" asChild>
                        <Link href={route('tenders.show', o.tenderId)}>
                            Open your tender <ArrowRight className="size-4" />
                        </Link>
                    </Button>
                ) : (
                    editable && (
                        <Button
                            size="sm"
                            disabled={starting}
                            onClick={() =>
                                router.post(
                                    route('opportunities.bid', o.id),
                                    {},
                                    { onStart: () => setStarting(true), onFinish: () => setStarting(false) },
                                )
                            }
                        >
                            {starting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                            {starting ? 'Reading the notice…' : 'Bid for this'}
                        </Button>
                    )
                )}
                <Button size="sm" variant="ghost" asChild>
                    <a href={o.url} target="_blank" rel="noreferrer">
                        View notice <ExternalLink className="size-3.5" />
                    </a>
                </Button>
                {asks > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
                        What they ask <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
                    </Button>
                )}
                <span className="text-muted-foreground ml-auto font-mono text-[11px]">{o.noticeId}</span>
            </div>
        </li>
    );
}
