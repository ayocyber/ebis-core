import { CategoryBadge, Kbd, MethodBadge, StaleBadge, StatusBadge } from '@/components/ebis/badges';
import { Input } from '@/components/ui/input';
import { categoryMeta, severityMeta, statusMeta, statusOrder, topicLabels } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import type { AssessmentStatus, EligibilityRow, RequirementCategory } from '@/types/ebis';
import { ChevronRight, Eye, Search, SearchX, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

export type CategoryFilter = 'all' | RequirementCategory;

export interface MatrixFilters {
    category: CategoryFilter;
    statuses: AssessmentStatus[];
    query: string;
    blockersOnly: boolean;
}

export const defaultFilters: MatrixFilters = { category: 'all', statuses: [], query: '', blockersOnly: false };

const categoryOrder: RequirementCategory[] = ['mandatory', 'scored', 'informational'];

export function applyFilters(rows: EligibilityRow[], f: MatrixFilters): EligibilityRow[] {
    const q = f.query.trim().toLowerCase();
    return rows.filter(({ requirement: r, assessment: a, gap }) => {
        if (f.category !== 'all' && r.category !== f.category) return false;
        if (f.statuses.length && !f.statuses.includes(a.status)) return false;
        if (f.blockersOnly && gap?.severity !== 'blocker') return false;
        if (q && !`${r.code} ${r.title} ${r.text} ${topicLabels[r.topic]}`.toLowerCase().includes(q)) return false;
        return true;
    });
}

interface Props {
    rows: EligibilityRow[];
    visibleRows: EligibilityRow[];
    filters: MatrixFilters;
    onFiltersChange: (f: MatrixFilters) => void;
    selectedId: string | null;
    onOpen: (requirementId: string) => void;
}

export function EligibilityMatrix({ rows, visibleRows, filters, onFiltersChange, selectedId, onOpen }: Props) {
    const searchRef = useRef<HTMLInputElement>(null);

    // "/" focuses search, like most data tools.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(target.tagName) && !target.isContentEditable) {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const categoryCounts = useMemo(() => {
        const counts: Record<CategoryFilter, number> = { all: rows.length, mandatory: 0, scored: 0, informational: 0 };
        rows.forEach(({ requirement }) => counts[requirement.category]++);
        return counts;
    }, [rows]);

    const statusCounts = useMemo(() => {
        const scoped = applyFilters(rows, { ...filters, statuses: [] });
        const counts: Record<AssessmentStatus, number> = { met: 0, partially_met: 0, not_met: 0, unknown: 0 };
        scoped.forEach(({ assessment }) => counts[assessment.status]++);
        return counts;
    }, [rows, filters]);

    const groups = useMemo(() => {
        return categoryOrder
            .map((category) => ({ category, rows: visibleRows.filter((r) => r.requirement.category === category) }))
            .filter((g) => g.rows.length);
    }, [visibleRows]);

    const isFiltered = filters.statuses.length > 0 || filters.query !== '' || filters.blockersOnly || filters.category !== 'all';

    const toggleStatus = (s: AssessmentStatus) =>
        onFiltersChange({
            ...filters,
            statuses: filters.statuses.includes(s) ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s],
        });

    return (
        <section className="bg-card overflow-hidden rounded-xl border shadow-xs" aria-label="Eligibility matrix">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b p-3 sm:p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div
                        className="bg-muted/70 -mx-1 flex overflow-x-auto rounded-lg p-1 [scrollbar-width:none] md:mx-0"
                        role="tablist"
                        aria-label="Requirement category"
                    >
                        {(['all', ...categoryOrder] as CategoryFilter[]).map((c) => {
                            const active = filters.category === c;
                            return (
                                <button
                                    key={c}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => onFiltersChange({ ...filters, category: c })}
                                    className={cn(
                                        'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
                                        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {c === 'all' ? 'All' : categoryMeta[c].label}
                                    <span
                                        className={cn(
                                            'rounded px-1.5 text-[11px] tabular-nums',
                                            active ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'bg-background/60',
                                        )}
                                    >
                                        {categoryCounts[c]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative md:w-72">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            ref={searchRef}
                            value={filters.query}
                            onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
                            onKeyDown={(e) => e.key === 'Escape' && onFiltersChange({ ...filters, query: '' })}
                            placeholder="Search requirements"
                            className="h-9 pr-9 pl-9"
                            aria-label="Search requirements"
                        />
                        {filters.query ? (
                            <button
                                onClick={() => onFiltersChange({ ...filters, query: '' })}
                                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5"
                                aria-label="Clear search"
                            >
                                <X className="size-4" />
                            </button>
                        ) : (
                            <Kbd className="absolute top-1/2 right-2.5 hidden -translate-y-1/2 md:inline-flex">/</Kbd>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground mr-1 text-xs font-medium">Status</span>
                    {statusOrder.map((s) => {
                        const active = filters.statuses.includes(s);
                        const meta = statusMeta[s];
                        return (
                            <button
                                key={s}
                                onClick={() => toggleStatus(s)}
                                aria-pressed={active}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                                    active
                                        ? cn(meta.pill, 'border-transparent ring-1 ring-inset')
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground bg-transparent',
                                )}
                            >
                                <span className={cn('size-1.5 rounded-full', meta.dot)} />
                                {meta.label}
                                <span className="tabular-nums opacity-70">{statusCounts[s]}</span>
                            </button>
                        );
                    })}
                    <button
                        onClick={() => onFiltersChange({ ...filters, blockersOnly: !filters.blockersOnly })}
                        aria-pressed={filters.blockersOnly}
                        className={cn(
                            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                            filters.blockersOnly
                                ? cn(severityMeta.blocker.className, 'border-transparent ring-1 ring-inset')
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                    >
                        Blockers only
                    </button>
                    {isFiltered && (
                        <button
                            onClick={() => onFiltersChange(defaultFilters)}
                            className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1 text-xs font-medium transition-colors"
                        >
                            <X className="size-3.5" /> Clear filters
                        </button>
                    )}
                </div>
            </div>

            {visibleRows.length === 0 ? (
                <EmptyState onReset={() => onFiltersChange(defaultFilters)} />
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden md:block">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-muted-foreground text-left text-xs">
                                <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-medium">
                                    <th className="w-20">Ref</th>
                                    <th>Requirement</th>
                                    <th className="hidden w-36 xl:table-cell">Topic</th>
                                    <th className="w-36">Status</th>
                                    <th className="hidden w-32 lg:table-cell">Checked by</th>
                                    <th className="w-10">
                                        <span className="sr-only">Open</span>
                                    </th>
                                </tr>
                            </thead>
                            {groups.map((group) => (
                                <tbody key={group.category} className="border-t first:border-t-0">
                                    <tr className="bg-muted/20">
                                        <td colSpan={6} className="px-4 py-2">
                                            <GroupHeader category={group.category} rows={group.rows} />
                                        </td>
                                    </tr>
                                    {group.rows.map((row, i) => (
                                        <MatrixRow
                                            key={row.requirement.id}
                                            row={row}
                                            index={i}
                                            selected={selectedId === row.requirement.id}
                                            onOpen={onOpen}
                                        />
                                    ))}
                                </tbody>
                            ))}
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <ul className="divide-y md:hidden">
                        {visibleRows.map((row) => (
                            <MobileRow key={row.requirement.id} row={row} selected={selectedId === row.requirement.id} onOpen={onOpen} />
                        ))}
                    </ul>
                </>
            )}

            <div className="text-muted-foreground flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs">
                <span>
                    Showing <span className="text-foreground font-medium tabular-nums">{visibleRows.length}</span> of {rows.length} requirements
                </span>
                <span className="hidden items-center gap-1.5 sm:flex">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd> to move between requirements in the drawer
                </span>
            </div>
        </section>
    );
}

function GroupHeader({ category, rows }: { category: RequirementCategory; rows: EligibilityRow[] }) {
    const met = rows.filter((r) => r.assessment.status === 'met').length;
    return (
        <div className="flex items-center gap-3">
            <CategoryBadge category={category} />
            <span className="text-muted-foreground text-xs">{categoryMeta[category].description}</span>
            <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {met}/{rows.length} met
            </span>
        </div>
    );
}

function MatrixRow({ row, index, selected, onOpen }: { row: EligibilityRow; index: number; selected: boolean; onOpen: (id: string) => void }) {
    const { requirement: r, assessment: a, gap } = row;
    return (
        <tr
            data-row-id={r.id}
            tabIndex={0}
            onClick={() => onOpen(r.id)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(r.id);
                }
            }}
            aria-selected={selected}
            style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
            className={cn(
                'group animate-fade-up cursor-pointer border-t transition-colors outline-none [&>td]:px-4 [&>td]:py-3',
                'hover:bg-accent/50 focus-visible:bg-accent/60',
                selected && 'bg-accent/70 hover:bg-accent/70',
            )}
        >
            <td className="align-top">
                <span className="text-muted-foreground font-mono text-xs font-medium">{r.code}</span>
            </td>
            <td className="align-top">
                <div className="flex items-start gap-2">
                    <div className="min-w-0">
                        <p className="text-foreground leading-snug font-medium">
                            {r.title}
                            {r.weight ? <span className="text-muted-foreground ml-2 text-xs font-normal tabular-nums">{r.weight} pts</span> : null}
                        </p>
                        <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{a.summary}</p>
                    </div>
                    {gap && (
                        <span
                            className={cn(
                                'mt-0.5 ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ring-inset',
                                severityMeta[gap.severity].className,
                            )}
                            title={`${severityMeta[gap.severity].label} gap: ${gap.title}`}
                        >
                            {severityMeta[gap.severity].label}
                        </span>
                    )}
                </div>
            </td>
            <td className="text-muted-foreground hidden align-top text-xs xl:table-cell">{topicLabels[r.topic]}</td>
            <td className="align-top">
                <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={a.status} />
                    {a.stale && <StaleBadge expiresAt={a.stale.expiresAt} className="text-[10px]" />}
                    {a.override && <span className="text-muted-foreground text-[10px]">Overridden</span>}
                </div>
            </td>
            <td className="hidden align-top lg:table-cell">
                <MethodBadge method={a.method} confidence={a.confidence} reviewed={a.reviewed} />
            </td>
            <td className="align-top">
                <span className="text-muted-foreground group-hover:text-foreground flex size-6 items-center justify-center rounded-md transition-all group-hover:translate-x-0.5">
                    {a.reviewed ? <ChevronRight className="size-4" /> : <Eye className="size-4" aria-label="Not yet reviewed" />}
                </span>
            </td>
        </tr>
    );
}

function MobileRow({ row, selected, onOpen }: { row: EligibilityRow; selected: boolean; onOpen: (id: string) => void }) {
    const { requirement: r, assessment: a, gap } = row;
    return (
        <li data-row-id={r.id}>
            <button
                onClick={() => onOpen(r.id)}
                className={cn('hover:bg-accent/50 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors', selected && 'bg-accent/70')}
            >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', statusMeta[a.status].dot)} aria-hidden />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-xs">{r.code}</span>
                        <CategoryBadge category={r.category} className="px-1.5 py-0 text-[10px]" />
                        {gap && (
                            <span className={cn('rounded px-1 text-[10px] font-semibold uppercase', severityMeta[gap.severity].className)}>
                                {severityMeta[gap.severity].label}
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm leading-snug font-medium">{r.title}</p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{a.summary}</p>
                    <div className="mt-2 flex items-center gap-3">
                        <StatusBadge status={a.status} />
                        <MethodBadge method={a.method} confidence={a.confidence} reviewed={a.reviewed} />
                        {a.stale && <StaleBadge expiresAt={a.stale.expiresAt} />}
                    </div>
                </div>
                <ChevronRight className="text-muted-foreground mt-1 size-4 shrink-0" />
            </button>
        </li>
    );
}

function EmptyState({ onReset }: { onReset: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
                <SearchX className="size-5" />
            </span>
            <p className="font-medium">No requirements match</p>
            <p className="text-muted-foreground max-w-sm text-sm">Try a different search or clear the filters to see the full matrix.</p>
            <button onClick={onReset} className="text-primary mt-1 text-sm font-medium hover:underline">
                Clear filters
            </button>
        </div>
    );
}
