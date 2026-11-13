import { ComplianceScreen } from '@/pages/tenders/compliance';
import type { BidSection, EligibilityRow, Tender } from '@/types/ebis';
import { router } from '@inertiajs/react';

/** Real tenders: moving a requirement to another section is saved (BID-01). */
export default function LiveCompliance({ tender, rows, sections }: { tender: Tender; rows: EligibilityRow[]; sections: BidSection[] }) {
    return (
        <ComplianceScreen
            tender={tender}
            rows={rows}
            sections={sections}
            mapping={{}}
            onMap={(requirementId, sectionId) =>
                router.post(
                    route('tenders.compliance.map', tender.id),
                    { requirement_id: requirementId, section_id: sectionId ?? null },
                    { preserveScroll: true, preserveState: true },
                )
            }
        />
    );
}
