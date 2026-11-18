import { useVault } from '@/hooks/use-vault';
import { exportName, resolveChecklist } from '@/lib/checklist';
import { downloadPost } from '@/lib/http';
import { DocumentsScreen } from '@/pages/tenders/documents';
import { type SharedData } from '@/types';
import type { BidSection, ChecklistItem, ChecklistProgress, Tender } from '@/types/ebis';
import { router, usePage } from '@inertiajs/react';
import { useMemo } from 'react';

/**
 * Real tenders: the checklist is worked out from the tender pack and requirements
 * on the server; progress and uploaded files are saved there (BID-02, BID-06).
 */
export default function LiveDocuments({
    tender,
    items,
    progress,
    files,
    sections,
}: {
    tender: Tender;
    items: ChecklistItem[];
    progress: Record<string, ChecklistProgress>;
    /** Items with an uploaded file */
    files: string[];
    sections: BidSection[];
}) {
    const supplier = usePage<SharedData>().props.tenant?.name ?? 'Supplier';
    const vault = useVault();

    const documents = useMemo(
        () => resolveChecklist(items, progress, { tender, supplier, documents: vault.documents, sections }),
        [items, progress, tender, supplier, vault.documents, sections],
    );

    const save = (itemId: string, patch: ChecklistProgress | null) => {
        // Removing a file sends fileName: undefined, which JSON would drop; the server needs null.
        const body = patch === null ? null : { ...patch, ...('fileName' in patch && patch.fileName === undefined ? { fileName: null } : {}) };
        router.patch(route('tenders.checklist.update', [tender.id, itemId]), { progress: body }, { preserveScroll: true });
    };

    return (
        <DocumentsScreen
            tender={tender}
            documents={documents}
            supplier={supplier}
            missing={[]}
            onSave={save}
            onUploadFile={(itemId, file) =>
                router.post(route('tenders.checklist.upload', [tender.id, itemId]), { file }, { forceFormData: true, preserveScroll: true })
            }
            fileHref={(itemId) => (files.includes(itemId) ? route('tenders.checklist.download', [tender.id, itemId]) : undefined)}
            packHref={route('tenders.pack', tender.id)}
            onDownloadForm={(itemId, fields) => {
                const item = items.find((i) => i.id === itemId);
                const name = item ? exportName(item, tender, supplier).replace(/\.\w+$/, '.docx') : 'Form.docx';
                return downloadPost(route('tenders.checklist.form', [tender.id, itemId]), { fields }, name);
            }}
        />
    );
}
