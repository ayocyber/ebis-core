import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tenders } from '@/data/mock-ebis';
import { type AuditCategory, auditCategoryMeta, auditCsv, useAudit } from '@/hooks/use-audit';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { Download, Lock, Search, SearchX, X } from 'lucide-react';
import { useMemo, useState } from 'react';

const selectClass =
    'border-input bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none';

const initials = (name: string) =>
    name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

export default function ActivityLog() {
    const events = useAudit();
    const [query, setQuery] = useState('');
    const [area, setArea] = useState<AuditCategory | ''>('');
    const [tender, setTender] = useState(() => {
        try {
            return new URLSearchParams(window.location.search).get('tender') ?? '';
        } catch {
            return '';
        }
    });
    const [person, setPerson] = useState('');

    const people = useMemo(() => [...new Set(events.map((e) => e.by))].sort(), [events]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return events.filter(
            (e) =>
                (!area || e.category === area) &&
                (!tender || e.tenderId === tender) &&
                (!person || e.by === person) &&
                (!q || `${e.by} ${e.action} ${e.target} ${e.detail ?? ''}`.toLowerCase().includes(q)),
        );
    }, [events, query, area, tender, person]);

    const byDay = useMemo(() => {
        const groups = new Map<string, typeof visible>();
        for (const e of visible) {
            const key = new Date(e.at).toDateString();
            groups.set(key, [...(groups.get(key) ?? []), e]);
        }
        return [...groups.entries()];
    }, [visible]);

    const filtered = !!(query || area || tender || person);
    const clear = () => {
        setQuery('');
        setArea('');
        setTender('');
        setPerson('');
    };

    const exportCsv = () => {
        const blob = new Blob([auditCsv(visible)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ebis-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const dayLabel = (key: string) => {
        const d = new Date(key);
        const today = new Date();
        const yesterday = new Date(Date.now() - 86_400_000);
        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Audit log', href: '/activity' }]}>
            <Head title="Audit log" />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <div className="animate-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
                        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                            Every assessment, override, decision and change made in EBIS Core, newest first.
                        </p>
                    </div>
                    <Button variant="outline" onClick={exportCsv} disabled={!visible.length}>
                        <Download className="size-4" /> Export CSV
                    </Button>
                </div>

                <p className="bg-muted/50 text-muted-foreground animate-fade-up flex items-center gap-2 rounded-lg px-3 py-2 text-xs [animation-delay:40ms]">
                    <Lock className="size-3.5 shrink-0" />
                    Read-only. Entries are added automatically and can’t be edited or deleted by anyone, including owners.
                </p>

                {/* Filters */}
                <div className="animate-fade-up flex flex-wrap items-center gap-2 [animation-delay:80ms]">
                    <div className="relative w-full sm:w-64">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the log" className="h-9 pl-9" />
                    </div>
                    <select className={selectClass} value={area} onChange={(e) => setArea(e.target.value as AuditCategory | '')} aria-label="Area">
                        <option value="">All areas</option>
                        {(Object.keys(auditCategoryMeta) as AuditCategory[]).map((c) => (
                            <option key={c} value={c}>
                                {auditCategoryMeta[c].label}
                            </option>
                        ))}
                    </select>
                    <select className={selectClass} value={tender} onChange={(e) => setTender(e.target.value)} aria-label="Tender">
                        <option value="">All tenders</option>
                        {tenders.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.reference} · {t.buyer.name}
                            </option>
                        ))}
                    </select>
                    <select className={selectClass} value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person">
                        <option value="">Everyone</option>
                        {people.map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                    {filtered && (
                        <Button variant="ghost" size="sm" onClick={clear}>
                            <X className="size-4" /> Clear
                        </Button>
                    )}
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                        {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
                    </span>
                </div>

                {/* Log */}
                {byDay.length === 0 ? (
                    <div className="bg-card flex flex-col items-center gap-2 rounded-2xl border px-6 py-16 text-center">
                        <SearchX className="text-muted-foreground size-8" />
                        <p className="font-medium">Nothing matches</p>
                        <button onClick={clear} className="text-primary text-sm font-medium hover:underline">
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {byDay.map(([day, list]) => (
                            <section key={day} aria-label={dayLabel(day)} className="animate-fade-up">
                                <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">{dayLabel(day)}</h2>
                                <ol className="bg-card divide-y overflow-hidden rounded-2xl border">
                                    {list.map((e) => {
                                        const meta = auditCategoryMeta[e.category];
                                        const t = e.tenderId ? tenders.find((x) => x.id === e.tenderId) : undefined;
                                        return (
                                            <li key={e.id} className="grid gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[64px_minmax(0,1fr)_auto]">
                                                <time
                                                    dateTime={e.at}
                                                    className="text-muted-foreground pt-0.5 text-xs tabular-nums"
                                                    title={new Date(e.at).toLocaleString('en-GB')}
                                                >
                                                    {new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                </time>
                                                <div className="flex min-w-0 gap-3">
                                                    <span
                                                        className={cn(
                                                            'flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                                                            e.by === 'EBIS' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                                                        )}
                                                    >
                                                        {e.by === 'EBIS' ? 'EB' : initials(e.by)}
                                                    </span>
                                                    <div className="min-w-0 text-sm">
                                                        <p className="leading-snug">
                                                            <span className="font-medium">{e.by}</span>{' '}
                                                            <span className="text-muted-foreground">{e.action}</span>{' '}
                                                            <span className="font-medium">{e.target}</span>
                                                        </p>
                                                        {e.detail && <p className="text-muted-foreground mt-0.5 text-xs break-words">{e.detail}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pl-10 sm:pl-0">
                                                    <span className="text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap">
                                                        <span className={cn('size-1.5 rounded-full', meta.dot)} />
                                                        {meta.label}
                                                    </span>
                                                    {t && (
                                                        <button
                                                            onClick={() => setTender(t.id)}
                                                            className="text-muted-foreground hover:text-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap"
                                                            title={`Show only ${t.reference}`}
                                                        >
                                                            {t.reference}
                                                        </button>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </section>
                        ))}
                    </div>
                )}

                <p className="text-muted-foreground text-center text-xs">
                    Looking for a tender’s full history? Open it and use{' '}
                    <Link href={route('tenders.index')} className="text-primary hover:underline">
                        History
                    </Link>{' '}
                    in its header.
                </p>
            </div>
        </AppLayout>
    );
}
