import { missingEvidence as tenderAsks } from '@/data/mock-vault';
import { setGapStatusFor } from '@/hooks/use-tender-workspace';
import { type DocUsage, usageFor } from '@/lib/vault';
import { type SharedData } from '@/types';
import type { MissingEvidence, VaultCategory, VaultDocument } from '@/types/ebis';
import { router, usePage } from '@inertiajs/react';

/**
 * The evidence vault, from the server (shared Inertia prop `vault`).
 *
 * `missing` is still worked out from the sample tenders until tenders are real (M2–M4):
 * an item disappears once a vault document proves the fact it asks for.
 */
export function useVault(): { documents: VaultDocument[]; missing: MissingEvidence[] } {
    const documents = usePage<SharedData>().props.vault?.documents ?? [];
    const held = new Set(documents.flatMap((d) => d.factIds));
    const titles = new Set(documents.map((d) => d.title.toLowerCase()));
    const missing = tenderAsks.filter((m) => (m.factId ? !held.has(m.factId) : !titles.has(m.title.toLowerCase())));
    return { documents, missing };
}

export interface NewVaultDocument {
    file: File;
    title: string;
    category: VaultCategory;
    issuer?: string;
    reference?: string;
    /** YYYY-MM-DD */
    issuedAt?: string;
    /** YYYY-MM-DD */
    expiresAt?: string;
    summary?: string;
    /** Facts this document proves, e.g. "pf-cep" */
    factIds?: string[];
    /** Id of the document this one renews */
    replaces?: string;
}

/** Inertia cancels a visit when another starts, so uploads go one at a time. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Upload to the vault. Resolves with the live tender requirements it now fixes,
 * rejects with the server's validation messages.
 */
export function saveDocument(doc: NewVaultDocument): Promise<DocUsage[]> {
    const next = queue.then(() => upload(doc));
    queue = next.catch(() => undefined);
    return next;
}

function upload(doc: NewVaultDocument): Promise<DocUsage[]> {
    return new Promise((resolve, reject) => {
        router.post(
            route('vault.store'),
            {
                file: doc.file,
                title: doc.title,
                category: doc.category,
                issuer: doc.issuer || null,
                reference: doc.reference || null,
                issued_at: doc.issuedAt || null,
                expires_at: doc.expiresAt || null,
                summary: doc.summary || null,
                fact_keys: doc.factIds?.length ? doc.factIds : null,
                replaces_id: doc.replaces ?? null,
            },
            {
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    const valid = !doc.expiresAt || new Date(doc.expiresAt) > new Date();
                    // Sample tenders: close the gaps this document resolves (real re-assessment arrives with M4).
                    const fixed = valid ? usageFor(doc.factIds ?? []).filter((u) => u.status !== 'met' && u.gapId) : [];
                    fixed.forEach((u) => setGapStatusFor(u.tender.id, u.gapId!, 'closed', `Closed by ${doc.title} in the vault`));
                    resolve(fixed);
                },
                onError: (errors) => reject(errors),
                onCancel: () => reject({ file: 'Upload cancelled.' }),
            },
        );
    });
}

export function deleteDocument(id: string, onDone?: () => void) {
    router.delete(route('vault.destroy', id), { preserveScroll: true, preserveState: true, onSuccess: onDone });
}

/** First validation message from a failed upload, for showing under the form. */
export const firstError = (errors: unknown): string =>
    errors && typeof errors === 'object' ? (Object.values(errors as Record<string, string>)[0] ?? 'Upload failed.') : 'Upload failed.';
