import { vaultDocuments as initialDocs, missingEvidence as initialMissing } from '@/data/mock-vault';
import { logEvent } from '@/hooks/use-audit';
import { setGapStatusFor } from '@/hooks/use-tender-workspace';
import { type DocUsage, usageFor } from '@/lib/vault';
import type { MissingEvidence, VaultDocument } from '@/types/ebis';
import { useSyncExternalStore } from 'react';

/**
 * In-memory evidence vault shared across pages until the backend exists.
 * Adding a document closes any open tender gap it resolves.
 */
interface VaultState {
    documents: VaultDocument[];
    missing: MissingEvidence[];
}

let state: VaultState = { documents: initialDocs, missing: initialMissing };
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

function emit(next: VaultState) {
    state = next;
    listeners.forEach((l) => l());
}

/** Save a document. Returns the tender requirements it now fixes. */
export function saveDocument(doc: VaultDocument, fillsMissingId?: string): DocUsage[] {
    const documents = [doc, ...state.documents.filter((d) => d.id !== doc.replaces)];
    const missing = fillsMissingId ? state.missing.filter((m) => m.id !== fillsMissingId) : state.missing;
    emit({ documents, missing });
    logEvent({
        category: 'vault',
        action: doc.replaces ? 'renewed' : 'added to the evidence vault',
        target: doc.title,
        by: doc.uploadedBy,
        detail: [doc.fileName, doc.expiresAt ? `valid to ${new Date(doc.expiresAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}` : '']
            .filter(Boolean)
            .join(' · '),
    });

    const valid = !doc.expiresAt || new Date(doc.expiresAt) > new Date();
    if (!valid) return [];

    const fixed = usageFor(doc.factIds).filter((u) => u.status !== 'met' && u.gapId);
    fixed.forEach((u) => setGapStatusFor(u.tender.id, u.gapId!, 'closed', `Closed by ${doc.title} in the vault`));
    return fixed;
}

export function deleteDocument(id: string) {
    const doc = state.documents.find((d) => d.id === id);
    if (doc) logEvent({ category: 'vault', action: 'deleted from the evidence vault', target: doc.title, detail: doc.fileName });
    emit({ ...state, documents: state.documents.filter((d) => d.id !== id) });
}

export function useVault() {
    return useSyncExternalStore(
        subscribe,
        () => state,
        () => state,
    );
}
