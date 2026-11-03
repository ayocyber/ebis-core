import { CategoryBadge, StatusBadge } from '@/components/ebis/badges';
import { TenderHeader } from '@/components/ebis/tender-header';
import { TenderNotFound } from '@/components/ebis/tender-not-found';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { findTender } from '@/data/mock-ebis';
import { useTenderWorkspace } from '@/hooks/use-tender-workspace';
import AppLayout from '@/layouts/app-layout';
import {
    buildComplianceRows,
    complianceCsv,
    complianceMeta,
    complianceOrder,
    type ComplianceRow,
    type ComplianceStatus,
    sectionStatusMeta,
} from '@/lib/compliance';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { BidSection } from '@/types/ebis';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Download,
    FileCheck2,
    FileSpreadsheet,
    FileText,
    Layers,
    Link2Off,
    Rows3,
    Search,
    SearchX,
    Sheet,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type View = 'requirements' | 'sections';

export default function TenderCompliance({ tenderId }: { tenderId: string }) {
    const { role } = usePage<SharedData>().props;
    const tender = findTender(tenderId);
    const { rows, sections } = useTenderWorkspace(tenderId);
    const [mapping, setMapping] = useState<Record<string, string | undefined>>({});
    const [view, setView] = useState<View>('requirements');
    const [statusFilter, setStatusFilter] = useState<ComplianceStatus | null>(null);
    const [query, setQuery] = useState('');

    const matrix = useMemo(() => buildComplianceRows(rows, sections, mapping), [rows, sections, mapping]);

    const counts = useMemo(() => {
        const c: Record<ComplianceStatus, number> = { compliant: 0, in_progress: 0, at_risk: 0, unanswered: 0 };
        matrix.forEach((r) => c[r.compliance]++);
        return c;
    }, [matrix]);

    if (!tender) return <TenderNotFound />;

    const mapped = matrix.filter((r) => r.section).length;
    const coverage = Math.round((mapped / matrix.length) * 100);
    const sectionsDone = sections.filter((s) => s.status === 'complete').length;

    const q = query.trim().toLowerCase();
    const visible = matrix.filter(
        (r) =>
            (!statusFilter || r.compliance === statusFilter) &&
            (!q || `${r.requirement.code} ${r.requirement.title} ${r.section?.title ?? ''}`.toLowerCase().includes(q)),
    );

    const exportCsv = () => {
        const blob = new Blob(['﻿' + complianceCsv(matrix)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), {
            href: url,
            download: `${tender.reference.replace(/\//g, '-')} compliance matrix.csv`,
        });
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference, href: `/tenders/${tender.id}/eligibility` },
                { title: 'Compliance matrix', href: `/tenders/${tender.id}/compliance` },
            ]}
        >
            <Head title={`Compliance · ${tender.reference}`} />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <TenderHeader
                    tender={tender}
                    viewing="compliance"
                    actions={
                        <>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('tenders.decision', tender.id)}>
                                    <ArrowLeft className="size-4" /> Decision
                                </Link>
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Download className="size-4" /> Export
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Download the matrix</DropdownMenuLabel>
                                    <DropdownMenuItem onSelect={exportCsv}>
                                        <Sheet className="size-4" /> CSV (opens in Excel)
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem disabled>
                                        <FileSpreadsheet className="size-4" /> Excel workbook <span className="ml-auto text-[10px]">Soon</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled>
                                        <FileText className="size-4" /> PDF for the buyer <span className="ml-auto text-[10px]">Soon</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('tenders.documents', tender.id)}>
                                    <FileCheck2 className="size-4" /> Documents
                                </Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link href={route('tenders.bid', tender.id)}>
                                    Write the bid <ArrowRight className="size-4" />
                                </Link>
                            </Button>
                        </>
                    }
                />

                {/* Coverage */}
                <section
                    className="bg-card grid gap-6 rounded-2xl border p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
                    aria-label="Coverage"
                >
                    <div className="flex items-center gap-5">
                        <CoverageRing value={coverage} />
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs font-medium">Requirements answered somewhere</p>
                            <p className="text-2xl font-semibold tracking-tight tabular-nums">
                                {mapped} <span className="text-muted-foreground text-base font-normal">of {matrix.length}</span>
                            </p>
                            <p className="text-muted-foreground text-sm">
                                {sectionsDone} of {sections.length} bid sections complete
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Compliance breakdown">
                            {complianceOrder.map((s) =>
                                counts[s] ? (
                                    <div
                                        key={s}
                                        className={cn(
                                            'h-full transition-[flex-grow] duration-500 first:rounded-l-full last:rounded-r-full',
                                            complianceMeta[s].bar,
                                        )}
                                        style={{ flexGrow: counts[s] }}
                                    />
                                ) : null,
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {complianceOrder.map((s) => {
                                const meta = complianceMeta[s];
                                const active = statusFilter === s;
                                return (
                                    <button
                                        key={s}
                                        onClick={() => setStatusFilter(active ? null : s)}
                                        aria-pressed={active}
                                        title={meta.hint}
                                        className={cn(
                                            'rounded-xl border p-3 text-left transition-all',
                                            active ? 'border-primary/40 bg-primary/5 ring-primary/20 ring-2' : 'hover:bg-muted/60',
                                        )}
                                    >
                                        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                            <span className={cn('size-2 rounded-full', meta.bar)} />
                                            {meta.label}
                                        </span>
                                        <span className="mt-1 block text-xl font-semibold tabular-nums">{counts[s]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div role="tablist" aria-label="View" className="bg-muted/60 inline-flex w-fit rounded-lg border p-0.5">
                        {(
                            [
                                ['requirements', 'By requirement', Rows3],
                                ['sections', 'By section', Layers],
                            ] as const
                        ).map(([v, label, Icon]) => (
                            <button
                                key={v}
                                role="tab"
                                aria-selected={view === v}
                                onClick={() => setView(v)}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                                    view === v
                                        ? 'bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Icon className="size-3.5" /> {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {statusFilter && (
                            <button
                                onClick={() => setStatusFilter(null)}
                                className="bg-muted hover:bg-muted/70 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                            >
                                {complianceMeta[statusFilter].label} <X className="size-3" />
                            </button>
                        )}
                        <div className="relative w-full sm:w-64">
                            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requirements" className="h-9 pl-8" />
                        </div>
                    </div>
                </div>

                {view === 'requirements' ? (
                    visible.length ? (
                        <RequirementTable
                            rows={visible}
                            sections={sections}
                            canEdit={canEdit(role)}
                            onMap={(reqId, sectionId) => setMapping((m) => ({ ...m, [reqId]: sectionId }))}
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
                            <SearchX className="text-muted-foreground size-8" />
                            <p className="font-medium">No requirements match.</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setQuery('');
                                    setStatusFilter(null);
                                }}
                            >
                                Clear filters
                            </Button>
                        </div>
                    )
                ) : (
                    <SectionGrid sections={sections} matrix={matrix} statusFilter={statusFilter} />
                )}
            </div>
        </AppLayout>
    );
}

function CoverageRing({ value }: { value: number }) {
    const r = 34;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative size-[88px] shrink-0">
            <svg viewBox="0 0 88 88" className="size-full -rotate-90" aria-hidden>
                <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
                <circle
                    cx="44"
                    cy="44"
                    r={r}
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="stroke-primary transition-[stroke-dashoffset] duration-700"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - value / 100)}
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">{value}%</span>
        </div>
    );
}

function CompliancePill({ status }: { status: ComplianceStatus }) {
    const meta = complianceMeta[status];
    const Icon = meta.icon;
    return (
        <span
            title={meta.hint}
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                meta.pill,
            )}
        >
            <Icon className="size-3.5" /> {meta.label}
        </span>
    );
}

function SectionPicker({
    row,
    sections,
    canEdit,
    onMap,
}: {
    row: ComplianceRow;
    sections: BidSection[];
    canEdit: boolean;
    onMap: (reqId: string, sectionId: string | undefined) => void;
}) {
    if (!canEdit) {
        return row.section ? <span className="text-sm">{row.section.title}</span> : <span className="text-muted-foreground text-sm">Not mapped</span>;
    }
    return (
        <Select value={row.section?.id ?? 'none'} onValueChange={(v) => onMap(row.requirement.id, v === 'none' ? undefined : v)}>
            <SelectTrigger
                aria-label={`Section answering ${row.requirement.code}`}
                className={cn('h-8 w-full max-w-64 text-left text-xs', !row.section && 'border-status-not-met/40 text-status-not-met border-dashed')}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="none">
                    <Link2Off className="size-3.5" /> Not mapped
                </SelectItem>
                {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                        {s.title}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function RequirementTable({
    rows,
    sections,
    canEdit,
    onMap,
}: {
    rows: ComplianceRow[];
    sections: BidSection[];
    canEdit: boolean;
    onMap: (reqId: string, sectionId: string | undefined) => void;
}) {
    return (
        <>
            {/* Desktop */}
            <div className="bg-card hidden overflow-hidden rounded-2xl border md:block">
                <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-muted-foreground text-left text-xs">
                        <tr>
                            <th className="w-16 px-4 py-3 font-medium">Code</th>
                            <th className="px-4 py-3 font-medium">Requirement</th>
                            <th className="hidden px-4 py-3 font-medium xl:table-cell">Source</th>
                            <th className="px-4 py-3 font-medium">Eligibility</th>
                            <th className="w-64 px-4 py-3 font-medium">Answered in</th>
                            <th className="px-4 py-3 text-right font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rows.map((r) => (
                            <tr key={r.requirement.id} className="hover:bg-muted/30 transition-colors">
                                <td className="text-muted-foreground px-4 py-3 align-top font-mono text-xs">{r.requirement.code}</td>
                                <td className="px-4 py-3 align-top">
                                    <p className="font-medium">{r.requirement.title}</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <CategoryBadge category={r.requirement.category} className="text-[10px]" />
                                        {r.requirement.weight && (
                                            <span className="text-muted-foreground text-xs">{r.requirement.weight}% weight</span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-muted-foreground hidden px-4 py-3 align-top text-xs xl:table-cell">
                                    p. {r.requirement.source.page} · {r.requirement.source.section}
                                </td>
                                <td className="px-4 py-3 align-top">
                                    <StatusBadge status={r.assessment.status} />
                                </td>
                                <td className="px-4 py-3 align-top">
                                    <SectionPicker row={r} sections={sections} canEdit={canEdit} onMap={onMap} />
                                    {r.section?.assignee && <p className="text-muted-foreground mt-1 text-xs">{r.section.assignee}</p>}
                                </td>
                                <td className="px-4 py-3 text-right align-top">
                                    <CompliancePill status={r.compliance} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile */}
            <ul className="space-y-2 md:hidden">
                {rows.map((r) => (
                    <li key={r.requirement.id} className="bg-card space-y-3 rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-muted-foreground font-mono text-xs">{r.requirement.code}</p>
                                <p className="font-medium">{r.requirement.title}</p>
                            </div>
                            <CompliancePill status={r.compliance} />
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusBadge status={r.assessment.status} />
                            <CategoryBadge category={r.requirement.category} className="text-[10px]" />
                        </div>
                        <SectionPicker row={r} sections={sections} canEdit={canEdit} onMap={onMap} />
                    </li>
                ))}
            </ul>
        </>
    );
}

function SectionGrid({ sections, matrix, statusFilter }: { sections: BidSection[]; matrix: ComplianceRow[]; statusFilter: ComplianceStatus | null }) {
    const unmapped = matrix.filter((r) => !r.section);

    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sections.map((s, i) => {
                const reqs = matrix.filter((r) => r.section?.id === s.id);
                if (statusFilter && !reqs.some((r) => r.compliance === statusFilter)) return null;
                const meta = sectionStatusMeta[s.status];
                const Icon = meta.icon;
                const errors = s.warnings.filter((w) => w.severity === 'error').length;
                const warns = s.warnings.length - errors;
                const words = s.body.trim() ? s.body.trim().split(/\s+/).length : 0;

                return (
                    <article
                        key={s.id}
                        className="bg-card animate-fade-up hover:border-primary/25 flex flex-col gap-4 rounded-xl border p-4 transition-colors sm:p-5"
                        style={{ animationDelay: `${i * 40}ms` }}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="leading-snug font-semibold tracking-tight">{s.title}</h3>
                            <span
                                className={cn(
                                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                                    meta.className,
                                )}
                            >
                                <Icon className="size-3.5" /> {meta.label}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {reqs.length ? (
                                reqs.map((r) => (
                                    <span
                                        key={r.requirement.id}
                                        title={`${r.requirement.title} — ${complianceMeta[r.compliance].label}`}
                                        className="bg-muted/60 flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px]"
                                    >
                                        <span className={cn('size-1.5 rounded-full', complianceMeta[r.compliance].bar)} />
                                        {r.requirement.code}
                                    </span>
                                ))
                            ) : (
                                <span className="text-muted-foreground text-xs">No requirements mapped</span>
                            )}
                        </div>

                        <div className="text-muted-foreground mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                            <span>{s.assignee}</span>
                            <span className="flex items-center gap-3">
                                {s.wordLimit && (
                                    <span className="tabular-nums">
                                        {words.toLocaleString()} / {s.wordLimit.toLocaleString()} words
                                    </span>
                                )}
                                {(errors > 0 || warns > 0) && (
                                    <span
                                        className={cn('flex items-center gap-1 font-medium', errors ? 'text-status-not-met' : 'text-status-partial')}
                                    >
                                        <AlertTriangle className="size-3.5" /> {errors + warns}
                                    </span>
                                )}
                            </span>
                        </div>
                    </article>
                );
            })}

            {unmapped.length > 0 && !statusFilter && (
                <article className="border-status-not-met/40 flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:p-5">
                    <h3 className="text-status-not-met flex items-center gap-1.5 font-semibold">
                        <Link2Off className="size-4" /> Not answered anywhere
                    </h3>
                    <ul className="space-y-1 text-sm">
                        {unmapped.map((r) => (
                            <li key={r.requirement.id}>
                                <span className="text-muted-foreground font-mono text-xs">{r.requirement.code}</span> {r.requirement.title}
                            </li>
                        ))}
                    </ul>
                    <p className="text-muted-foreground mt-auto text-xs">Switch to “By requirement” to map each one to a section.</p>
                </article>
            )}
        </div>
    );
}
