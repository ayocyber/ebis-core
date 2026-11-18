import type { ScoreRun } from '@/hooks/use-tender-workspace';
import { useVault } from '@/hooks/use-vault';
import { resolveChecklist } from '@/lib/checklist';
import { ValidationScreen } from '@/pages/tenders/validation';
import { type SharedData } from '@/types';
import type { BidSection, ChecklistItem, ChecklistProgress, EligibilityRow, GoNoGoDecision, Tender } from '@/types/ebis';
import { router, usePage } from '@inertiajs/react';
import { useCallback, useMemo } from 'react';

/** No submission rules are read from real tender packs yet. */
const NO_RULES: never[] = [];

/**
 * Real tenders: the issues are worked out here from real data, the score history
 * and sign-off are saved on the server (VAL-06…08). No submission rules are read
 * from the pack yet, so none are checked.
 */
export default function LiveValidation({
    tender,
    rows,
    sections,
    decision,
    items,
    progress,
    scoreHistory,
    signedOff,
}: {
    tender: Tender;
    rows: EligibilityRow[];
    sections: BidSection[];
    decision: GoNoGoDecision;
    items: ChecklistItem[];
    progress: Record<string, ChecklistProgress>;
    scoreHistory: ScoreRun[];
    signedOff: { by: string; at: string } | null;
}) {
    const { tenant, errors } = usePage<SharedData & { errors: Record<string, string> }>().props;
    const supplier = tenant?.name ?? 'Supplier';
    const vault = useVault();

    const documents = useMemo(
        () => resolveChecklist(items, progress, { tender, supplier, documents: vault.documents, sections }),
        [items, progress, tender, supplier, vault.documents, sections],
    );

    const recordScore = useCallback(
        (score: number, critical: number, manual = false) => {
            const last = scoreHistory[scoreHistory.length - 1];
            if (!manual && last && last.score === score && last.critical === critical) return;
            router.post(route('tenders.readiness.store', tender.id), { score, critical, manual }, { preserveScroll: true, preserveState: true });
        },
        [scoreHistory, tender.id],
    );

    return (
        <ValidationScreen
            tender={tender}
            rows={rows}
            sections={sections}
            decision={decision}
            documents={documents}
            rules={NO_RULES}
            scoreHistory={scoreHistory}
            recordScore={recordScore}
            signedOff={signedOff ?? undefined}
            onSignOff={() => router.post(route('tenders.signoff.store', tender.id), {}, { preserveScroll: true })}
            onUndoSignOff={() => router.delete(route('tenders.signoff.destroy', tender.id), { preserveScroll: true })}
            signOffError={errors?.signoff}
            packHref={route('tenders.pack', tender.id)}
        />
    );
}
