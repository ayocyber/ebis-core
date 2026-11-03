import { applyFilters, defaultFilters, EligibilityMatrix, type MatrixFilters } from '@/components/eligibility/eligibility-matrix';
import { EligibilitySummary, type SummaryShortcut } from '@/components/eligibility/eligibility-summary';
import { EvidenceDrawer } from '@/components/eligibility/evidence-drawer';
import { logEvent } from '@/hooks/use-audit';
import { statusMeta } from '@/lib/ebis';
import type { AssessmentStatus, EligibilityRow } from '@/types/ebis';
import { useCallback, useMemo, useState } from 'react';

interface Props {
    initialRows: EligibilityRow[];
    canEdit: boolean;
    currentUserName: string;
}

/**
 * Stage 4 — the eligibility matrix with its summary and evidence drawer.
 * Owns filter, selection and (for now, local) override state.
 */
export function EligibilityDashboard({ initialRows, canEdit, currentUserName }: Props) {
    const [rows, setRows] = useState(initialRows);
    const [filters, setFilters] = useState<MatrixFilters>(defaultFilters);
    const [shortcut, setShortcut] = useState<SummaryShortcut | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Matrix shows rows grouped by category, so navigation follows the same order.
    const visibleRows = useMemo(() => {
        const order = { mandatory: 0, scored: 1, informational: 2 } as const;
        return applyFilters(rows, filters).sort((a, b) => order[a.requirement.category] - order[b.requirement.category]);
    }, [rows, filters]);

    const selectedIndex = visibleRows.findIndex((r) => r.requirement.id === selectedId);
    const selectedRow = rows.find((r) => r.requirement.id === selectedId) ?? null;

    const updateFilters = (next: MatrixFilters) => {
        setFilters(next);
        setShortcut(null);
    };

    const applyShortcut = (s: SummaryShortcut) => {
        if (shortcut === s) {
            setFilters(defaultFilters);
            setShortcut(null);
            return;
        }
        const next: Record<SummaryShortcut, MatrixFilters> = {
            blockers: { ...defaultFilters, blockersOnly: true },
            'mandatory-issues': { ...defaultFilters, category: 'mandatory', statuses: ['not_met', 'partially_met'] },
            unknown: { ...defaultFilters, statuses: ['unknown'] },
            scored: { ...defaultFilters, category: 'scored' },
        };
        setFilters(next[s]);
        setShortcut(s);
    };

    const open = (id: string) => {
        setSelectedId(id);
        setDrawerOpen(true);
    };

    const step = useCallback(
        (delta: number) => {
            const nextIdx = selectedIndex + delta;
            if (nextIdx < 0 || nextIdx >= visibleRows.length) return;
            const id = visibleRows[nextIdx].requirement.id;
            setSelectedId(id);
            // Keep the highlighted row in view behind the drawer.
            requestAnimationFrame(() => document.querySelector(`[data-row-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
        },
        [selectedIndex, visibleRows],
    );

    const updateAssessment = (id: string, fn: (row: EligibilityRow) => EligibilityRow) =>
        setRows((prev) => prev.map((r) => (r.requirement.id === id ? fn(r) : r)));

    const handleOverride = (id: string, status: AssessmentStatus, reason: string) => {
        const row = rows.find((r) => r.requirement.id === id);
        if (row)
            logEvent({
                category: 'override',
                action: 'overrode the result for',
                target: `${row.requirement.code} · ${row.requirement.title}`,
                tenderId: row.requirement.tenderId,
                detail: `${statusMeta[row.assessment.status].label} → ${statusMeta[status].label} · “${reason}”`,
            });
        updateAssessment(id, (row) => ({
            ...row,
            assessment: {
                ...row.assessment,
                status,
                reviewed: true,
                override: {
                    previousStatus: row.assessment.override?.previousStatus ?? row.assessment.status,
                    reason,
                    by: currentUserName,
                    at: new Date().toISOString(),
                },
            },
        }));
    };

    const handleToggleReviewed = (id: string) => {
        const row = rows.find((r) => r.requirement.id === id);
        if (row)
            logEvent({
                category: 'assessment',
                action: row.assessment.reviewed ? 'marked as not reviewed' : 'reviewed the result for',
                target: `${row.requirement.code} · ${row.requirement.title}`,
                tenderId: row.requirement.tenderId,
                detail: statusMeta[row.assessment.status].label,
            });
        updateAssessment(id, (row) => ({ ...row, assessment: { ...row.assessment, reviewed: !row.assessment.reviewed } }));
    };

    return (
        <div className="space-y-4">
            <EligibilitySummary rows={rows} active={shortcut} onShortcut={applyShortcut} />

            <EligibilityMatrix
                rows={rows}
                visibleRows={visibleRows}
                filters={filters}
                onFiltersChange={updateFilters}
                selectedId={drawerOpen ? selectedId : null}
                onOpen={open}
            />

            <EvidenceDrawer
                row={selectedRow}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                position={{ index: Math.max(0, selectedIndex), total: visibleRows.length }}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                canEdit={canEdit}
                onOverride={handleOverride}
                onToggleReviewed={handleToggleReviewed}
            />
        </div>
    );
}
