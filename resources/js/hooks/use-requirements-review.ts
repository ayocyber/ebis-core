import { type ExtractedField, type ExtractedRequirement, extractedRequirements, tenderFields } from '@/data/mock-requirements';
import type { Requirement, Tender } from '@/types/ebis';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Requirements review (TUN-02/03, ING-04, TUN-06): the user's edits on top of what EBIS
 * extracted. In memory until the backend stores versions and the audit log.
 */
export interface ReviewState {
    edits: Record<string, Partial<Requirement>>;
    deleted: string[];
    added: ExtractedRequirement[];
    /** Low-confidence items the user has checked */
    checked: string[];
    /** Tender detail values the user typed or corrected */
    fields: Record<string, string>;
    /** Reading problems the user has looked at */
    problemsChecked: string[];
    confirmed?: { by: string; at: string; count: number };
}

const empty = (): ReviewState => ({ edits: {}, deleted: [], added: [], checked: [], fields: {}, problemsChecked: [] });

const state = new Map<string, ReviewState>();
const listeners = new Set<() => void>();

const get = (id: string) => {
    if (!state.has(id)) state.set(id, empty());
    return state.get(id)!;
};
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export function useRequirementsReview(tenderId: string, tender: Tender | undefined) {
    const s = useSyncExternalStore(
        subscribe,
        () => get(tenderId),
        () => get(tenderId),
    );

    const update = useCallback(
        (fn: (s: ReviewState) => ReviewState) => {
            state.set(tenderId, fn(get(tenderId)));
            listeners.forEach((l) => l());
        },
        [tenderId],
    );

    const requirements = useMemo(() => {
        if (!tender) return [];
        return [...extractedRequirements(tender), ...s.added].map((r) => ({
            ...r,
            ...s.edits[r.id],
            edited: !!s.edits[r.id],
            deleted: s.deleted.includes(r.id),
            checked: s.checked.includes(r.id),
        }));
    }, [tender, s]);

    const fields = useMemo<(ExtractedField & { edited: boolean })[]>(
        () => (tender ? tenderFields(tender).map((f) => ({ ...f, value: s.fields[f.key] ?? f.value, edited: f.key in s.fields })) : []),
        [tender, s.fields],
    );

    return { state: s, requirements, fields, update };
}

export type ReviewedRequirement = ReturnType<typeof useRequirementsReview>['requirements'][number];
