import { type SharedData } from '@/types';
import type { VaultCategory, VaultDocument } from '@/types/ebis';
import { router, usePage } from '@inertiajs/react';

/**
 * The evidence vault, from the server (shared Inertia prop `vault`).
 * What each tender is missing lives on that tender's gaps page.
 */
export function useVault(): { documents: VaultDocument[] } {
    return { documents: usePage<SharedData>().props.vault?.documents ?? [] };
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

/** Upload to the vault. Rejects with the server's validation messages. */
export function saveDocument(doc: NewVaultDocument): Promise<void> {
    const next = queue.then(() => upload(doc));
    queue = next.catch(() => undefined);
    return next;
}

function upload(doc: NewVaultDocument): Promise<void> {
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
                // Tenders close the gaps it fixes when eligibility is checked again.
                onSuccess: () => resolve(),
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
