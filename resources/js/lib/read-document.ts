import { evidenceSlots, type EvidenceSlot } from '@/data/evidence-slots';

/** What the server could read from a file before it is saved (DocumentReader). */
export interface DocumentReading {
    readable: boolean;
    /** Evidence slot id the text reads like, e.g. "el" */
    kind: string | null;
    issuer: string | null;
    reference: string | null;
    expires_at: string | null;
    fact: string | null;
}

/** Sends the file to be read. Nothing is stored. Resolves null when reading fails, so the user just types the details. */
export async function readDocument(file: File): Promise<DocumentReading | null> {
    const body = new FormData();
    body.append('file', file);
    const token = decodeURIComponent(document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1] ?? '');
    try {
        const res = await fetch('/vault/read', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest' },
            body,
        });
        return res.ok ? ((await res.json()) as DocumentReading) : null;
    } catch {
        return null;
    }
}

export const slotFor = (kind: string | null | undefined): EvidenceSlot | undefined => (kind ? evidenceSlots.find((s) => s.id === kind) : undefined);

/** Which details were filled in from the text, for "Read from the document: …". */
export function foundFields(r: DocumentReading | null | undefined): string[] {
    if (!r) return [];
    return [r.issuer && 'issuer', r.reference && 'reference', r.expires_at && 'expiry date', r.fact && 'cover'].filter(Boolean) as string[];
}
