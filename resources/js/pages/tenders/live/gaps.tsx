import { Button } from '@/components/ui/button';
import { canEdit } from '@/lib/roles';
import { GapsScreen } from '@/pages/tenders/gaps';
import { type SharedData } from '@/types';
import type { EligibilityRow, Tender } from '@/types/ebis';
import { router, usePage } from '@inertiajs/react';
import { Info, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

/** Real tenders: gap progress is saved on the server (GAP-05). */
export default function LiveGaps({ tender, rows }: { tender: Tender; rows: EligibilityRow[] }) {
    const { role } = usePage<SharedData>().props;
    const [running, setRunning] = useState(false);

    return (
        <GapsScreen
            tender={tender}
            rows={rows}
            onStatusChange={(row, status) =>
                router.patch(route('tenders.gaps.update', [tender.id, row.gap!.id]), { status }, { preserveScroll: true })
            }
            // A plain vault upload; checking again closes the gap once the document is there.
            uploadTargetFor={(row) => ({
                missing: { id: `gap-${row.gap!.id}`, title: row.gap!.evidence!.title, category: row.gap!.evidence!.category, why: row.gap!.remedy },
            })}
            notice={
                <div className="bg-muted/50 flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-start gap-2">
                        <Info className="text-primary mt-0.5 size-4 shrink-0" />
                        Uploaded a missing document or updated your profile? Check eligibility again and the gaps it fixes close by themselves.
                    </p>
                    {canEdit(role) && (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={running}
                            onClick={() =>
                                router.post(
                                    route('tenders.eligibility.run', tender.id),
                                    {},
                                    { onStart: () => setRunning(true), onFinish: () => setRunning(false) },
                                )
                            }
                        >
                            {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Check again
                        </Button>
                    )}
                </div>
            }
        />
    );
}
