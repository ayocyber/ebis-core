import { useSyncExternalStore } from 'react';

/**
 * Audit log (EVD-05): an append-only record of assessments, overrides, decisions,
 * gap changes, bid edits and vault changes. Entries can be added and read, never
 * edited or removed. In memory until the backend stores it.
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

const seed: Omit<AuditEvent, 'id'>[] = [
    {
        at: '2026-11-01T15:42:00Z',
        by: 'EBIS',
        category: 'assessment',
        action: 'finished the eligibility check on',
        target: 'NCC/ICT/2026/014',
        tenderId: 'tnd-001',
        detail: '18 requirements · rules engine v1.4 · profile version 12',
    },
    {
        at: '2026-11-01T15:30:00Z',
        by: 'Emma Richardson',
        category: 'requirements',
        action: 'confirmed the requirements for',
        target: 'NCC/ICT/2026/014',
        tenderId: 'tnd-001',
        detail: '18 requirements · 1 removed (duplicate of M-08)',
    },
    {
        at: '2026-11-01T11:05:00Z',
        by: 'Kemi Adebayo',
        category: 'gap',
        action: 'started work on',
        target: 'M-03 · Renew Cyber Essentials Plus',
        tenderId: 'tnd-001',
        detail: 'Open → In progress',
    },
    {
        at: '2026-10-31T16:20:00Z',
        by: 'Priya Nair',
        category: 'bid',
        action: 'marked a section complete in',
        target: 'NGU/EST/2026/022 · Key personnel',
        tenderId: 'tnd-004',
        detail: 'In review → Complete',
    },
    {
        at: '2026-10-31T09:12:00Z',
        by: 'EBIS',
        category: 'vault',
        action: 'flagged an expired document',
        target: 'Cyber Essentials Plus',
        detail: 'Expired 31 Oct 2026 · used by 3 live tenders',
    },
    {
        at: '2026-10-30T14:48:00Z',
        by: 'Emma Richardson',
        category: 'override',
        action: 'overrode the result for',
        target: 'S-02 · Key personnel qualifications',
        tenderId: 'tnd-004',
        detail: 'Partially met → Met · “Daniel’s CCIE renewal letter confirms it is current until 2028.”',
    },
    {
        at: '2026-10-29T14:05:00Z',
        by: 'Tom Barker',
        category: 'requirements',
        action: 'imported a tender from Contracts Finder',
        target: 'RNT/ICT/2026/007',
        tenderId: 'tnd-003',
    },
    {
        at: '2026-10-29T09:30:00Z',
        by: 'James Oliver',
        category: 'gap',
        action: 'asked Hartwell Group for a parent company guarantee for',
        target: 'M-07 · Turnover below £2m threshold',
        tenderId: 'tnd-001',
    },
    {
        at: '2026-10-22T10:02:00Z',
        by: 'James Oliver',
        category: 'decision',
        action: 'decided to bid for',
        target: 'NGU/EST/2026/022',
        tenderId: 'tnd-004',
        detail: '“Strong fit and an existing relationship with the estates team.”',
    },
    {
        at: '2026-10-14T15:31:00Z',
        by: 'Grace Lee',
        category: 'profile',
        action: 'updated the company profile',
        target: 'Employees',
        detail: '38 → 42',
    },
];

let events: AuditEvent[] = seed.map((e, i) => ({ ...e, id: `seed-${i}` }));
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

export function useAudit(): readonly AuditEvent[] {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => events,
        () => events,
    );
}

export function auditCsv(list: readonly AuditEvent[]): string {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ['When', 'Who', 'Area', 'What', 'Target', 'Tender', 'Detail'];
    const rows = list.map((e) =>
        [e.at, e.by, auditCategoryMeta[e.category].label, e.action, e.target, e.tenderId ?? '', e.detail ?? ''].map(esc).join(','),
    );
    return [head.join(','), ...rows].join('\n');
}
