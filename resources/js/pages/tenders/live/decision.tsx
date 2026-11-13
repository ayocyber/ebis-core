import { DecisionScreen } from '@/pages/tenders/decision';
import type { EligibilityRow, GoNoGoDecision, Tender } from '@/types/ebis';
import { router } from '@inertiajs/react';
import { useState } from 'react';

/**
 * Real tenders: the decision is saved on the server (DEC-02). Changing it records a
 * new decision; earlier ones stay in the history and the activity log.
 */
export default function LiveDecision({ tender, rows, decision }: { tender: Tender; rows: EligibilityRow[]; decision: GoNoGoDecision | null }) {
    const [changing, setChanging] = useState(false);

    return (
        <DecisionScreen
            tender={tender}
            rows={rows}
            decision={changing ? undefined : (decision ?? undefined)}
            onDecide={(d) =>
                router.post(
                    route('tenders.decision.store', tender.id),
                    { outcome: d.outcome, reason: d.reason, acknowledged_blockers: d.acknowledgedBlockers, conditions: d.conditions ?? [] },
                    { preserveScroll: true, onSuccess: () => setChanging(false) },
                )
            }
            onChange={() => setChanging(true)}
        />
    );
}
