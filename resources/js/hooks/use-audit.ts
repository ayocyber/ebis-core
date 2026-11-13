import { useMemo, useSyncExternalStore } from 'react';

/**
 * Audit log (EVD-05): an append-only record of assessments, overrides, decisions,
 * gap changes, bid edits and vault changes. The server writes and stores it (vault and
 * profile so far); pages pass the server entries to useAudit(), which merges in any
 * entries from the sample tender pages.
 */
export type AuditCategory = 'requirements' | 'assessment' | 'override' | 'gap' | 'decision' | 'bid' | 'documents' | 'signoff' | 'vault' | 'profile';

export interface AuditEvent {
    readonly id: string;
    readonly at: string;
    readonly by: string;
    readonly category: AuditCategory;
    /** Short sentence after the person's name, e.g. "closed the gap" */
    readonly action: string;
    /** What it happened to, e.g. "M-03 · Renew Cyber Essentials Plus" */
    readonly target: string;
    readonly tenderId?: string;
    /** Extra detail: a reason, old → new value */
    readonly detail?: string;
}

export const auditCategoryMeta: Record<AuditCategory, { label: string; dot: string }> = {
    requirements: { label: 'Requirements', dot: 'bg-sky-500' },
    assessment: { label: 'Eligibility', dot: 'bg-primary' },
    override: { label: 'Override', dot: 'bg-status-partial' },
    gap: { label: 'Gaps', dot: 'bg-amber-500' },
    decision: { label: 'Go / No-Go', dot: 'bg-violet-500' },
    bid: { label: 'Bid writing', dot: 'bg-indigo-500' },
    documents: { label: 'Documents', dot: 'bg-teal-500' },
    signoff: { label: 'Sign-off', dot: 'bg-status-met' },
    vault: { label: 'Evidence vault', dot: 'bg-emerald-600' },
    profile: { label: 'Company profile', dot: 'bg-slate-500' },
};

/**
 * Entries made this session on the sample-data tender pages. They are not saved:
 * the server log (EVD-05) takes over area by area as each part gets a backend.
 */
let events: AuditEvent[] = [];
const listeners = new Set<() => void>();
let actor = 'You';

/** Called by the app layout so entries are attributed to whoever is signed in. */
export function setAuditActor(name: string | undefined) {
    if (name) actor = name;
}

export const currentActor = () => actor;

/** Current entries, newest first (outside React). */
export const auditEvents = (): readonly AuditEvent[] => events;

export function logEvent(e: Omit<AuditEvent, 'id' | 'at' | 'by'> & { by?: string }) {
    const event: AuditEvent = Object.freeze({ ...e, by: e.by ?? actor, id: `ev-${Date.now()}-${events.length}`, at: new Date().toISOString() });
    events = [event, ...events];
    listeners.forEach((l) => l());
}

/** Server entries plus this session's sample-page entries, newest first. */
export function useAudit(server: readonly AuditEvent[] = []): readonly AuditEvent[] {
    const local = useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => events,
        () => events,
    );
    return useMemo(() => (local.length ? [...local, ...server].sort((a, b) => b.at.localeCompare(a.at)) : server), [local, server]);
}

export function auditCsv(list: readonly AuditEvent[]): string {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ['When', 'Who', 'Area', 'What', 'Target', 'Tender', 'Detail'];
    const rows = list.map((e) =>
        [e.at, e.by, auditCategoryMeta[e.category].label, e.action, e.target, e.tenderId ?? '', e.detail ?? ''].map(esc).join(','),
    );
    return [head.join(','), ...rows].join('\n');
}
