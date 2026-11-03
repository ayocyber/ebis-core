import { StatusBadge } from '@/components/ebis/badges';
import { TenderHeader } from '@/components/ebis/tender-header';
import { TenderNotFound } from '@/components/ebis/tender-not-found';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { draftFor } from '@/data/mock-bid';
import { findTender } from '@/data/mock-ebis';
import { type SectionVersion, useTenderWorkspace } from '@/hooks/use-tender-workspace';
import AppLayout from '@/layouts/app-layout';
import { sectionStatusMeta } from '@/lib/compliance';
import { factSourceLabels } from '@/lib/ebis';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { BidSection, ProfileFact } from '@/types/ebis';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    BookOpen,
    CheckCircle2,
    CircleX,
    FileCheck2,
    FileText,
    History,
    ListChecks,
    Loader2,
    Plus,
    Quote,
    RotateCcw,
    Save,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Panel = 'requirements' | 'evidence' | 'checks' | 'history';

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const countCitations = (t: string) => (t.match(/\[[^\]]+\]/g) ?? []).length;

export default function TenderBid({ tenderId }: { tenderId: string }) {
    const { role, auth } = usePage<SharedData>().props;
    const tender = findTender(tenderId);
    const { rows, sections, versions, updateSection, saveVersion, restoreVersion } = useTenderWorkspace(tenderId);
    const editable = canEdit(role);

    const [selectedId, setSelectedId] = useState(() => sections.find((s) => s.warnings.length)?.id ?? sections[0]?.id);
    const [panel, setPanel] = useState<Panel>('checks');
    const [drafting, setDrafting] = useState(false);
    const textRef = useRef<HTMLTextAreaElement>(null);
    const timer = useRef<number | null>(null);

    const section = sections.find((s) => s.id === selectedId) ?? sections[0];
    const reqs = useMemo(() => rows.filter((r) => section?.requirementIds.includes(r.requirement.id)), [rows, section]);
    const facts = useMemo(() => {
        const map = new Map<string, ProfileFact>();
        reqs.forEach((r) => r.assessment.evidence.profileFacts.forEach((f) => map.set(f.id, f)));
        return [...map.values()];
    }, [reqs]);

    // Stop any running draft when switching sections or leaving.
    useEffect(() => () => stopDrafting(), [selectedId]);

    // Grow the textarea with its content.
    useEffect(() => {
        const el = textRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, 360)}px`;
    }, [section?.body, selectedId]);

    if (!tender || !section) return <TenderNotFound />;

    function stopDrafting() {
        if (timer.current) window.clearInterval(timer.current);
        timer.current = null;
        setDrafting(false);
    }

    const draftWithEbis = () => {
        const words = draftFor(section).split(' ');
        const start = section.body.trim() ? `${section.body.trim()}\n\n` : '';
        let i = 0;
        setDrafting(true);
        if (section.status === 'not_started') updateSection(section.id, { status: 'drafting' });
        timer.current = window.setInterval(() => {
            i += 2;
            updateSection(section.id, { body: start + words.slice(0, i).join(' ') });
            if (i >= words.length) {
                stopDrafting();
                saveVersion(section.id, 'Drafted by EBIS', 'EBIS');
            }
        }, 30);
    };

    const insertCitation = (fact: ProfileFact) => {
        const el = textRef.current;
        const token = ` [${fact.label}]`;
        const at = el ? el.selectionEnd : section.body.length;
        const body = section.body.slice(0, at) + token + section.body.slice(at);
        updateSection(section.id, { body });
        requestAnimationFrame(() => {
            el?.focus();
            el?.setSelectionRange(at + token.length, at + token.length);
        });
    };

    const jumpTo = (excerpt: string) => {
        const el = textRef.current;
        const at = section.body.indexOf(excerpt);
        if (!el || at < 0) return;
        el.focus();
        el.setSelectionRange(at, at + excerpt.length);
    };

    const sectionVersions = versions[section.id] ?? [];
    const words = countWords(section.body);
    const over = section.wordLimit ? words > section.wordLimit : false;
    const done = sections.filter((s) => s.status === 'complete').length;
    const errors = section.warnings.filter((w) => w.severity === 'error').length;

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference, href: `/tenders/${tender.id}/eligibility` },
                { title: 'Bid', href: `/tenders/${tender.id}/bid` },
            ]}
        >
            <Head title={`Bid · ${tender.reference}`} />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <TenderHeader
                    tender={tender}
                    viewing="drafting"
                    actions={
                        <>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('tenders.compliance', tender.id)}>
                                    <ArrowLeft className="size-4" /> Compliance
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('tenders.documents', tender.id)}>
                                    <FileCheck2 className="size-4" /> Documents
                                </Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link href={route('tenders.validation', tender.id)}>
                                    Check readiness <ArrowRight className="size-4" />
                                </Link>
                            </Button>
                        </>
                    }
                />

                {/* Mobile section picker */}
                <div className="xl:hidden">
                    <Select value={section.id} onValueChange={setSelectedId}>
                        <SelectTrigger className="h-11 w-full" aria-label="Section">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {sections.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
                    {/* Section list */}
                    <nav aria-label="Bid sections" className="bg-card hidden overflow-hidden rounded-2xl border xl:sticky xl:top-20 xl:block">
                        <div className="border-b px-4 py-3">
                            <p className="text-sm font-semibold">Sections</p>
                            <p className="text-muted-foreground text-xs">
                                {done} of {sections.length} complete
                            </p>
                            <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
                                <div
                                    className="bg-status-met h-full rounded-full transition-[width] duration-500"
                                    style={{ width: `${(done / sections.length) * 100}%` }}
                                />
                            </div>
                        </div>
                        <ol className="p-1.5">
                            {sections.map((s, i) => (
                                <SectionItem key={s.id} index={i + 1} section={s} active={s.id === section.id} onClick={() => setSelectedId(s.id)} />
                            ))}
                        </ol>
                    </nav>

                    {/* Editor */}
                    <section className="bg-card overflow-hidden rounded-2xl border" aria-label="Editor">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                                <p className="text-muted-foreground text-xs">
                                    Answers {reqs.map((r) => r.requirement.code).join(', ') || 'no requirements yet'} ·{' '}
                                    {section.assignee ?? 'Unassigned'}
                                </p>
                            </div>
                            <Select
                                value={section.status}
                                onValueChange={(v) => {
                                    const next = v as BidSection['status'];
                                    saveVersion(section.id, `Marked ${sectionStatusMeta[next].label.toLowerCase()}`);
                                    updateSection(section.id, { status: next });
                                }}
                                disabled={!editable}
                            >
                                <SelectTrigger className="h-8 w-36 text-xs" aria-label="Section status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(sectionStatusMeta) as BidSection['status'][]).map((st) => (
                                        <SelectItem key={st} value={st}>
                                            {sectionStatusMeta[st].label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                            <div className="flex items-center gap-1">
                                {drafting ? (
                                    <Button size="sm" variant="ghost" onClick={stopDrafting}>
                                        <Loader2 className="size-4 animate-spin" /> Writing… stop
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="ghost" onClick={draftWithEbis} disabled={!editable} className="text-primary">
                                        <Sparkles className="size-4" /> {section.body.trim() ? 'Continue with EBIS' : 'Draft with EBIS'}
                                    </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => setPanel('evidence')} className="hidden sm:inline-flex">
                                    <Quote className="size-4" /> Cite evidence
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        saveVersion(section.id, 'Saved by hand');
                                        setPanel('history');
                                    }}
                                    disabled={!editable || drafting || !section.body.trim()}
                                    className="hidden sm:inline-flex"
                                >
                                    <Save className="size-4" /> Save version
                                </Button>
                            </div>
                            <div className="flex items-center gap-3 pr-2 text-xs">
                                <span className="text-muted-foreground tabular-nums">{countCitations(section.body)} citations</span>
                                <span className={cn('tabular-nums', over ? 'text-status-not-met font-semibold' : 'text-muted-foreground')}>
                                    {words.toLocaleString()}
                                    {section.wordLimit ? ` / ${section.wordLimit.toLocaleString()}` : ''} words
                                </span>
                            </div>
                        </div>
                        {section.wordLimit && (
                            <div className="bg-muted h-0.5">
                                <div
                                    className={cn('h-full transition-[width] duration-300', over ? 'bg-status-not-met' : 'bg-primary')}
                                    style={{ width: `${Math.min(100, (words / section.wordLimit) * 100)}%` }}
                                />
                            </div>
                        )}

                        <div className="relative">
                            <label htmlFor="section-body" className="sr-only">
                                {section.title}
                            </label>
                            <textarea
                                id="section-body"
                                ref={textRef}
                                value={section.body}
                                readOnly={!editable || drafting}
                                onBlur={() => editable && !drafting && saveVersion(section.id, 'Edited')}
                                onChange={(e) => {
                                    updateSection(section.id, {
                                        body: e.target.value,
                                        ...(section.status === 'not_started' && e.target.value.trim() ? { status: 'drafting' as const } : {}),
                                    });
                                }}
                                placeholder="Start writing, or let EBIS draft this section from the tender clauses and your evidence."
                                className="placeholder:text-muted-foreground/70 block min-h-[360px] w-full resize-none bg-transparent px-5 py-5 text-[15px] leading-7 outline-none sm:px-8 sm:py-7"
                            />
                            {!section.body.trim() && !drafting && editable && (
                                <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
                                    <Button
                                        size="sm"
                                        onClick={draftWithEbis}
                                        className="pointer-events-auto rounded-full shadow-[0_10px_28px_-12px_var(--glow)]"
                                    >
                                        <Sparkles className="size-4" /> Draft this section with EBIS
                                    </Button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Side panel */}
                    <aside className="bg-card overflow-hidden rounded-2xl border xl:sticky xl:top-20" aria-label="Section helpers">
                        <div role="tablist" className="grid grid-cols-4 border-b text-xs font-medium">
                            {(
                                [
                                    ['checks', 'Checks', ListChecks, section.warnings.length],
                                    ['requirements', 'Asks', FileText, reqs.length],
                                    ['evidence', 'Evidence', BookOpen, facts.length],
                                    ['history', 'History', History, sectionVersions.length],
                                ] as const
                            ).map(([p, label, Icon, n]) => (
                                <button
                                    key={p}
                                    role="tab"
                                    aria-selected={panel === p}
                                    onClick={() => setPanel(p)}
                                    className={cn(
                                        'flex items-center justify-center gap-1.5 border-b-2 py-3 transition-colors',
                                        panel === p
                                            ? 'border-primary text-foreground'
                                            : 'text-muted-foreground hover:text-foreground border-transparent',
                                    )}
                                >
                                    <Icon className="size-3.5" /> {label}
                                    <span
                                        className={cn(
                                            'rounded-full px-1.5 text-[10px] tabular-nums',
                                            p === 'checks' && n
                                                ? errors
                                                    ? 'bg-status-not-met/15 text-status-not-met'
                                                    : 'bg-status-partial/15 text-status-partial'
                                                : 'bg-muted',
                                        )}
                                    >
                                        {n}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto p-4">
                            {panel === 'checks' &&
                                (section.warnings.length ? (
                                    <ul className="space-y-3">
                                        {section.warnings.map((w) => (
                                            <li
                                                key={w.id}
                                                className={cn(
                                                    'rounded-xl border p-3',
                                                    w.severity === 'error'
                                                        ? 'border-status-not-met/30 bg-status-not-met/5'
                                                        : 'border-status-partial/30 bg-status-partial/5',
                                                )}
                                            >
                                                <p className="flex items-center gap-1.5 text-xs font-semibold">
                                                    {w.severity === 'error' ? (
                                                        <CircleX className="text-status-not-met size-3.5" />
                                                    ) : (
                                                        <AlertTriangle className="text-status-partial size-3.5" />
                                                    )}
                                                    {w.severity === 'error' ? 'Unsupported claim' : 'Check this claim'}
                                                </p>
                                                <p className="mt-2 text-sm">“{w.excerpt}”</p>
                                                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{w.message}</p>
                                                <button
                                                    onClick={() => jumpTo(w.excerpt)}
                                                    className="text-primary mt-2 text-xs font-medium hover:underline"
                                                >
                                                    Show in text
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                                        <ShieldCheck className="text-status-met size-8" />
                                        <p className="text-sm font-medium">No claim problems</p>
                                        <p className="text-muted-foreground text-xs">Every claim EBIS checked is backed by your evidence.</p>
                                    </div>
                                ))}

                            {panel === 'requirements' && (
                                <ul className="space-y-3">
                                    {reqs.map((r) => (
                                        <li key={r.requirement.id} className="rounded-xl border p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-medium">
                                                    <span className="text-muted-foreground mr-1.5 font-mono text-xs">{r.requirement.code}</span>
                                                    {r.requirement.title}
                                                </p>
                                                <StatusBadge status={r.assessment.status} className="text-[10px]" />
                                            </div>
                                            <p className="border-primary/40 text-muted-foreground mt-2 border-l-2 pl-2.5 text-xs leading-relaxed">
                                                {r.requirement.source.quote}
                                            </p>
                                            <p className="text-muted-foreground mt-2 text-[11px]">
                                                p. {r.requirement.source.page} · {r.requirement.source.section}
                                                {r.requirement.weight ? ` · ${r.requirement.weight}% weight` : ''}
                                            </p>
                                        </li>
                                    ))}
                                    {!reqs.length && (
                                        <p className="text-muted-foreground py-6 text-center text-sm">Map requirements in the compliance matrix.</p>
                                    )}
                                </ul>
                            )}

                            {panel === 'history' && (
                                <VersionHistory
                                    versions={sectionVersions}
                                    current={section.body}
                                    editable={editable && !drafting}
                                    onRestore={(id) => restoreVersion(section.id, id, auth.user.name)}
                                />
                            )}

                            {panel === 'evidence' && (
                                <ul className="space-y-2">
                                    {facts.map((f) => (
                                        <li key={f.id} className="hover:border-primary/30 group rounded-xl border p-3 transition-colors">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                                                        {factSourceLabels[f.source]}
                                                    </p>
                                                    <p className="text-sm font-medium">{f.label}</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 shrink-0 px-2 text-xs"
                                                    onClick={() => insertCitation(f)}
                                                    disabled={!editable || drafting}
                                                >
                                                    <Plus className="size-3.5" /> Cite
                                                </Button>
                                            </div>
                                            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{f.value}</p>
                                        </li>
                                    ))}
                                    {!facts.length && (
                                        <p className="text-muted-foreground py-6 text-center text-sm">No evidence linked to this section yet.</p>
                                    )}
                                </ul>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}

function VersionHistory({
    versions,
    current,
    editable,
    onRestore,
}: {
    versions: SectionVersion[];
    current: string;
    editable: boolean;
    onRestore: (id: string) => void;
}) {
    const [open, setOpen] = useState<string | null>(null);
    if (!versions.length)
        return (
            <p className="text-muted-foreground py-6 text-center text-sm">
                No saved versions yet. EBIS keeps one every time you leave the editor, change the status or draft with EBIS.
            </p>
        );
    return (
        <ol className="space-y-2">
            {versions.map((v, i) => {
                const isCurrent = v.body === current;
                const expanded = open === v.id;
                return (
                    <li key={v.id} className={cn('rounded-xl border p-3', isCurrent && 'border-primary/30 bg-primary/[0.03]')}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">
                                    {v.label}
                                    {isCurrent && <span className="text-primary ml-1.5 text-[11px] font-semibold">Current</span>}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    {v.by} ·{' '}
                                    {new Date(v.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ·{' '}
                                    {countWords(v.body).toLocaleString()} words
                                    {i === versions.length - 1 && ' · oldest'}
                                </p>
                            </div>
                            {!isCurrent && editable && (
                                <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={() => onRestore(v.id)}>
                                    <RotateCcw className="size-3.5" /> Restore
                                </Button>
                            )}
                        </div>
                        <button onClick={() => setOpen(expanded ? null : v.id)} className="text-primary mt-1.5 text-xs font-medium hover:underline">
                            {expanded ? 'Hide text' : 'Show text'}
                        </button>
                        {expanded && (
                            <p className="bg-muted/50 text-muted-foreground mt-2 max-h-48 overflow-y-auto rounded-lg p-2.5 text-xs leading-relaxed whitespace-pre-wrap">
                                {v.body}
                            </p>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

function SectionItem({ index, section, active, onClick }: { index: number; section: BidSection; active: boolean; onClick: () => void }) {
    const meta = sectionStatusMeta[section.status];
    const errors = section.warnings.filter((w) => w.severity === 'error').length;
    return (
        <li>
            <button
                onClick={onClick}
                aria-current={active ? 'true' : undefined}
                className={cn(
                    'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                    active ? 'bg-primary/8 dark:bg-primary/15' : 'hover:bg-muted/60',
                )}
            >
                <span
                    className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
                        section.status === 'complete' ? 'bg-status-met/15 text-status-met' : 'bg-muted text-muted-foreground',
                    )}
                >
                    {section.status === 'complete' ? <CheckCircle2 className="size-3.5" /> : index}
                </span>
                <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm leading-snug', active && 'font-medium')}>{section.title}</span>
                    <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[11px]">
                        <span className={cn('size-1.5 rounded-full', meta.dot)} /> {meta.label}
                        {section.warnings.length > 0 && (
                            <span
                                className={cn(
                                    'ml-auto flex items-center gap-0.5 font-medium',
                                    errors ? 'text-status-not-met' : 'text-status-partial',
                                )}
                            >
                                <AlertTriangle className="size-3" /> {section.warnings.length}
                            </span>
                        )}
                    </span>
                </span>
            </button>
        </li>
    );
}
