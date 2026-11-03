import { checklistFor } from '@/data/mock-checklist';
import { useTenderWorkspace } from '@/hooks/use-tender-workspace';
import { useVault } from '@/hooks/use-vault';
import { resolveChecklist } from '@/lib/checklist';
import { type SharedData } from '@/types';
import type { Tender } from '@/types/ebis';
import { usePage } from '@inertiajs/react';
import { useMemo } from 'react';

/** The tender workspace plus its resolved documents checklist (live against the vault). */
export function useChecklist(tenderId: string, tender: Tender | undefined) {
    const ws = useTenderWorkspace(tenderId);
    const vault = useVault();
    const supplier = usePage<SharedData>().props.tenant?.name ?? 'Supplier';

    const documents = useMemo(
        () =>
            tender
                ? resolveChecklist(checklistFor(tenderId), ws.checklist, { tender, supplier, documents: vault.documents, sections: ws.sections })
                : [],
        [tender, tenderId, ws.checklist, ws.sections, vault.documents, supplier],
    );

    return { ...ws, vault, supplier, documents };
}
