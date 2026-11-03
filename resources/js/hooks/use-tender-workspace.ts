import { bidSectionsFor } from '@/data/mock-bid';
import { checklistItems, checklistSeed } from '@/data/mock-checklist';
import { eligibilityRowsFor, findTender } from '@/data/mock-ebis';
import { currentActor, logEvent } from '@/hooks/use-audit';
import type { BidSection, ChecklistProgress, EligibilityRow, Gap, GoNoGoDecision } from '@/types/ebis';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Client-side store for gap progress, the Go / No-Go decision and bid drafts.
 * Lives in memory so changes survive Inertia page visits (gaps → decision →
 * compliance → bid) until the backend persists them. Every meaningful change
 * is written to the audit log (EVD-05).
 */

/** BID-05: a saved copy of a section that can be restored. */
export interface SectionVersion {
    id: string;
    at: string;
    by: string;
    label: string;
    body: string;
}

interface WorkspaceState {
    gapStatus: Record<string, Gap['status']>;
    decision?: GoNoGoDecision;
    sectionEdits: Record<string, Partial<BidSection>>;
    signedOff?: { by: string; at: string };
    /** Documents checklist progress, keyed by checklist item id */
    checklist: Record<string, ChecklistProgress>;
    /** Saved versions per section, newest first */
    versions: Record<string, SectionVersion[]>;
    /** VAL-07: every readiness check, oldest first */
    scoreHistory: ScoreRun[];
}

export interface ScoreRun {
    at: string;
    score: number;
    critical: number;
    by: string;
}

/** Earlier checks, so the first visit already has a "previous" score to compare with. */
const seedHistory = (): ScoreRun[] => [
    { at: '2026-10-30T09:05:00Z', score: 18, critical: 11, by: 'EBIS' },
    { at: '2026-11-01T15:50:00Z', score: 24, critical: 9, by: 'EBIS' },
];

type SectionPatch = Partial<Pick<BidSection, 'body' | 'status' | 'assignee'>>;

const state = new Map<string, WorkspaceState>();
const listeners = new Set<() => void>();
let version = 0;
const rowCache = new Map<string, { key: WorkspaceState['gapStatus']; rows: EligibilityRow[] }>();
const sectionCache = new Map<string, { key: WorkspaceState['sectionEdits']; sections: BidSection[] }>();

const gapLabel: Record<Gap['status'], string> = { open: 'Open', in_progress: 'In progress', closed: 'Closed' };
const statusLabel: Record<BidSection['status'], string> = {
    not_started: 'Not started',
    drafting: 'Drafting',
    in_review: 'In review',
    complete: 'Complete',
};

/** The bodies the sample sections start with become each section's first version. */
function initialVersions(tenderId: string): WorkspaceState['versions'] {
    return Object.fromEntries(
        bidSectionsFor(tenderId)
            .filter((s) => s.body.trim())
            .map((s) => [s.id, [{ id: `v0-${s.id}`, at: '2026-10-30T16:00:00Z', by: s.assignee ?? 'EBIS', label: 'First draft', body: s.body }]]),
    );
}

function get(tenderId: string): WorkspaceState {
    let s = state.get(tenderId);
    if (!s) {
        s = { gapStatus: {}, sectionEdits: {}, checklist: { ...checklistSeed }, versions: initialVersions(tenderId), scoreHistory: seedHistory() };
        state.set(tenderId, s);
    }
    return s;
}

function set(tenderId: string, next: WorkspaceState) {
    state.set(tenderId, next);
    version++;
    listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Rows with any locally changed gap status applied. Stable between changes. */
function rowsFor(tenderId: string): EligibilityRow[] {
    const { gapStatus } = get(tenderId);
    const cached = rowCache.get(tenderId);
    if (cached && cached.key === gapStatus) return cached.rows;

    const rows = eligibilityRowsFor(tenderId).map((r) =>
        r.gap && gapStatus[r.gap.id] ? { ...r, gap: { ...r.gap, status: gapStatus[r.gap.id] } } : r,
    );
    rowCache.set(tenderId, { key: gapStatus, rows });
    return rows;
}

/** Bid sections with local edits applied. Claim warnings drop once their text is gone. */
function sectionsFor(tenderId: string): BidSection[] {
    const { sectionEdits } = get(tenderId);
    const cached = sectionCache.get(tenderId);
    if (cached && cached.key === sectionEdits) return cached.sections;

    const sections = bidSectionsFor(tenderId).map((s) => {
        const merged = { ...s, ...sectionEdits[s.id] };
        return { ...merged, warnings: merged.warnings.filter((w) => merged.body.includes(w.excerpt)) };
    });
    sectionCache.set(tenderId, { key: sectionEdits, sections });
    return sections;
}

const ref = (tenderId: string) => findTender(tenderId)?.reference ?? tenderId;

function changeGap(tenderId: string, gapId: string, status: Gap['status'], detail?: string) {
    const s = get(tenderId);
    const row = rowsFor(tenderId).find((r) => r.gap?.id === gapId);
    const before = row?.gap?.status;
    if (before === status) return;
    set(tenderId, { ...s, gapStatus: { ...s.gapStatus, [gapId]: status } });
    logEvent({
        category: 'gap',
        action: status === 'closed' ? 'closed a gap on' : status === 'in_progress' ? 'started work on a gap on' : 'reopened a gap on',
        target: `${ref(tenderId)} · ${row?.requirement.code} ${row?.gap?.title ?? ''}`.trim(),
        tenderId,
        detail: [before ? `${gapLabel[before]} → ${gapLabel[status]}` : gapLabel[status], detail].filter(Boolean).join(' · '),
    });
}

function addVersion(tenderId: string, sectionId: string, label: string, body: string, by?: string) {
    const s = get(tenderId);
    const list = s.versions[sectionId] ?? [];
    if (list[0]?.body === body) return; // nothing changed since the last version
    const v: SectionVersion = { id: `v-${Date.now()}-${list.length}`, at: new Date().toISOString(), by: by ?? currentActor(), label, body };
    set(tenderId, { ...s, versions: { ...s.versions, [sectionId]: [v, ...list] } });
}

export function useTenderWorkspace(tenderId: string) {
    const snapshot = useSyncExternalStore(
        subscribe,
        () => get(tenderId),
        () => get(tenderId),
    );
    const rows = rowsFor(tenderId);
    const sections = sectionsFor(tenderId);

    const setGapStatus = useCallback((gapId: string, status: Gap['status']) => changeGap(tenderId, gapId, status), [tenderId]);

    const setDecision = useCallback(
        (decision: GoNoGoDecision | undefined) => {
            set(tenderId, { ...get(tenderId), decision });
            logEvent(
                decision
                    ? {
                          category: 'decision',
                          action: decision.outcome === 'proceed' ? 'decided to bid for' : 'decided not to bid for',
                          target: ref(tenderId),
                          tenderId,
                          by: decision.decidedBy,
                          detail: [decision.reason ? `“${decision.reason}”` : 'No reason given', ...(decision.conditions ?? [])].join(' · '),
                      }
                    : { category: 'decision', action: 'reopened the Go / No-Go decision for', target: ref(tenderId), tenderId },
            );
        },
        [tenderId],
    );

    const updateSection = useCallback(
        (sectionId: string, patch: SectionPatch) => {
            const s = get(tenderId);
            const current = sectionsFor(tenderId).find((x) => x.id === sectionId);
            set(tenderId, { ...s, sectionEdits: { ...s.sectionEdits, [sectionId]: { ...s.sectionEdits[sectionId], ...patch } } });
            // Status changes are logged; individual keystrokes are captured as versions instead.
            if (patch.status && current && patch.status !== current.status) {
                logEvent({
                    category: 'bid',
                    action: 'changed a section’s status in',
                    target: `${ref(tenderId)} · ${current.title}`,
                    tenderId,
                    detail: `${statusLabel[current.status]} → ${statusLabel[patch.status]}`,
                });
            }
        },
        [tenderId],
    );

    /** BID-05: keep a restorable copy of the section as it is now. */
    const saveVersion = useCallback(
        (sectionId: string, label: string, by?: string) => {
            const body = sectionsFor(tenderId).find((x) => x.id === sectionId)?.body ?? '';
            if (body.trim()) addVersion(tenderId, sectionId, label, body, by);
        },
        [tenderId],
    );

    const restoreVersion = useCallback(
        (sectionId: string, versionId: string, by?: string) => {
            const v = get(tenderId).versions[sectionId]?.find((x) => x.id === versionId);
            const current = sectionsFor(tenderId).find((x) => x.id === sectionId);
            if (!v || !current) return;
            // Keep what's being replaced, so a restore can itself be undone.
            addVersion(tenderId, sectionId, 'Before restore', current.body, by);
            const s = get(tenderId);
            set(tenderId, { ...s, sectionEdits: { ...s.sectionEdits, [sectionId]: { ...s.sectionEdits[sectionId], body: v.body } } });
            addVersion(tenderId, sectionId, `Restored “${v.label}”`, v.body, by);
            logEvent({
                category: 'bid',
                action: 'restored an earlier version in',
                target: `${ref(tenderId)} · ${current.title}`,
                tenderId,
                detail: `${v.label} by ${v.by}, ${new Date(v.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
            });
        },
        [tenderId],
    );

    const setSignedOff = useCallback(
        (signedOff: WorkspaceState['signedOff']) => {
            set(tenderId, { ...get(tenderId), signedOff });
            logEvent(
                signedOff
                    ? { category: 'signoff', action: 'signed off the bid for', target: ref(tenderId), tenderId, by: signedOff.by }
                    : { category: 'signoff', action: 'withdrew the sign-off for', target: ref(tenderId), tenderId },
            );
        },
        [tenderId],
    );

    /** Merge a patch into an item's progress; null clears it back to nothing. */
    const updateChecklist = useCallback(
        (itemId: string, patch: ChecklistProgress | null) => {
            const s = get(tenderId);
            const next = { ...s.checklist };
            if (patch === null) delete next[itemId];
            else next[itemId] = { ...next[itemId], ...patch };
            set(tenderId, { ...s, checklist: next });

            const title = checklistItems.find((i) => i.id === itemId)?.title ?? itemId;
            const action =
                patch === null
                    ? 'put back on the checklist'
                    : patch.notApplicable
                      ? 'marked as not needed'
                      : patch.fileName
                        ? 'uploaded a file for'
                        : 'fileName' in patch
                          ? 'removed the file from'
                          : 'filled in';
            logEvent({ category: 'documents', action, target: `${ref(tenderId)} · ${title}`, tenderId, detail: patch?.fileName });
        },
        [tenderId],
    );

    /** VAL-07: keep this run. Automatic runs are only kept when the score moved. */
    const recordScore = useCallback(
        (score: number, critical: number, manual = false) => {
            const s = get(tenderId);
            const last = s.scoreHistory[s.scoreHistory.length - 1];
            if (!manual && last && last.score === score && last.critical === critical) return;
            const run: ScoreRun = { at: new Date().toISOString(), score, critical, by: manual ? currentActor() : 'EBIS' };
            set(tenderId, { ...s, scoreHistory: [...s.scoreHistory, run] });
        },
        [tenderId],
    );

    return {
        rows,
        sections,
        scoreHistory: snapshot.scoreHistory,
        recordScore,
        decision: snapshot.decision,
        signedOff: snapshot.signedOff,
        checklist: snapshot.checklist,
        versions: snapshot.versions,
        setGapStatus,
        setDecision,
        updateSection,
        saveVersion,
        restoreVersion,
        setSignedOff,
        updateChecklist,
    };
}

/** Update a gap from outside a tender page, e.g. when the vault receives the missing document. */
export function setGapStatusFor(tenderId: string, gapId: string, status: Gap['status'], detail?: string) {
    changeGap(tenderId, gapId, status, detail);
}

export interface WorkspaceView {
    rows: EligibilityRow[];
    sections: BidSection[];
    decision?: GoNoGoDecision;
    signedOff?: WorkspaceState['signedOff'];
    checklist: Record<string, ChecklistProgress>;
}

/** Read-only view of several tenders at once (dashboard). Re-renders on any change. */
export function useWorkspaces(tenderIds: string[]): Record<string, WorkspaceView> {
    useSyncExternalStore(
        subscribe,
        () => version,
        () => version,
    );
    return Object.fromEntries(
        tenderIds.map((id) => {
            const s = get(id);
            return [id, { rows: rowsFor(id), sections: sectionsFor(id), decision: s.decision, signedOff: s.signedOff, checklist: s.checklist }];
        }),
    );
}
