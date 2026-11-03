/**
 * Works out where each checklist item stands (BID-02) and what's wrong with it
 * (VAL-02 missing items, VAL-03 file format, VAL-04 expiry before the deadline).
 */
import { formatDate } from '@/lib/ebis';
import type { BidSection, ChecklistItem, ChecklistKind, ChecklistProgress, Tender, VaultDocument } from '@/types/ebis';
import { CheckCircle2, CircleDashed, CircleSlash, Clock3, FileWarning, type LucideIcon } from 'lucide-react';

export type ChecklistStatus = 'ready' | 'in_progress' | 'missing' | 'problem' | 'not_applicable';

export const checklistStatusMeta: Record<ChecklistStatus, { label: string; icon: LucideIcon; pill: string; text: string }> = {
    ready: {
        label: 'Ready',
        icon: CheckCircle2,
        pill: 'bg-status-met/10 text-status-met ring-status-met/25',
        text: 'text-status-met',
    },
    in_progress: {
        label: 'In progress',
        icon: Clock3,
        pill: 'bg-status-partial/10 text-status-partial ring-status-partial/25',
        text: 'text-status-partial',
    },
    missing: {
        label: 'Missing',
        icon: CircleDashed,
        pill: 'bg-muted text-muted-foreground ring-border',
        text: 'text-muted-foreground',
    },
    problem: {
        label: 'Problem',
        icon: FileWarning,
        pill: 'bg-status-not-met/10 text-status-not-met ring-status-not-met/25',
        text: 'text-status-not-met',
    },
    not_applicable: {
        label: 'Not needed',
        icon: CircleSlash,
        pill: 'bg-muted text-muted-foreground ring-border',
        text: 'text-muted-foreground',
    },
};

export const checklistStatusOrder: ChecklistStatus[] = ['problem', 'missing', 'in_progress', 'ready', 'not_applicable'];

export const checklistKindMeta: Record<ChecklistKind, { label: string; hint: string }> = {
    form: { label: 'Forms to complete', hint: 'EBIS fills in what it already knows. You add the rest and sign.' },
    bid: { label: 'Files for this bid', hint: 'Prepared for this tender only. Not saved to your vault.' },
    company: { label: 'From your evidence vault', hint: 'Attached automatically. Renew in the vault and every bid updates.' },
    response: { label: 'Your written response', hint: 'Built in the bid editor.' },
};

export const checklistKindOrder: ChecklistKind[] = ['form', 'bid', 'company', 'response'];

export interface ResolvedItem {
    item: ChecklistItem;
    progress: ChecklistProgress;
    status: ChecklistStatus;
    /** One line on where it stands */
    note: string;
    /** Set when status is "problem" or "missing": what to do */
    issue?: string;
    vaultDoc?: VaultDocument;
    /** form items: how many fields are filled */
    filled?: { done: number; total: number };
    /** Name the file will have in the submission pack */
    exportName: string;
}

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

export const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** e.g. NCC-ICT-2026-014_Bluewave-Networks_Form01_FormOfTender.pdf */
export function exportName(item: ChecklistItem, tender: Tender, supplier: string): string {
    return `${slug(tender.reference)}_${slug(supplier)}_${item.fileStem}.${item.formats[0]}`;
}

export function formFields(item: ChecklistItem, progress: ChecklistProgress) {
    return (item.fields ?? []).map((f) => ({ ...f, value: progress.fields?.[f.id] ?? f.prefill ?? '' }));
}

export function resolveChecklist(
    items: ChecklistItem[],
    progress: Record<string, ChecklistProgress>,
    ctx: { tender: Tender; supplier: string; documents: VaultDocument[]; sections: BidSection[] },
): ResolvedItem[] {
    const deadline = new Date(ctx.tender.deadline);

    return items.map((item) => {
        const pr = progress[item.id] ?? {};
        const base = { item, progress: pr, exportName: exportName(item, ctx.tender, ctx.supplier) };
        const wrongFormat = pr.fileName && !item.formats.includes(ext(pr.fileName));
        const formatIssue = `Must be ${item.formats.map((f) => `.${f}`).join(' or ')}. You uploaded a .${ext(pr.fileName ?? '')} file.`;

        if (pr.notApplicable) return { ...base, status: 'not_applicable', note: 'Marked as not needed for this bid' };

        switch (item.kind) {
            case 'response': {
                const done = ctx.sections.filter((s) => s.status === 'complete').length;
                const total = ctx.sections.length;
                const started = ctx.sections.some((s) => s.body.trim());
                return {
                    ...base,
                    status: done === total ? 'ready' : started ? 'in_progress' : 'missing',
                    note: `${done} of ${total} sections complete`,
                    issue: done === total ? undefined : 'Finish and mark every section complete in the bid editor.',
                };
            }

            case 'company': {
                const re = new RegExp(item.vaultMatch ?? '^$', 'i');
                const doc = ctx.documents
                    .filter((d) => re.test(d.title))
                    .sort((a, b) => +new Date(b.expiresAt ?? '9999') - +new Date(a.expiresAt ?? '9999'))[0];
                if (!doc)
                    return {
                        ...base,
                        status: 'missing',
                        note: 'Not in your vault',
                        issue: 'Upload it to your vault. It will be reused for future bids.',
                    };
                if (doc.expiresAt && new Date(doc.expiresAt) < deadline) {
                    const past = new Date(doc.expiresAt) < new Date();
                    return {
                        ...base,
                        vaultDoc: doc,
                        status: 'problem',
                        note: `${doc.fileName} · ${past ? 'expired' : 'expires'} ${formatDate(doc.expiresAt)}`,
                        issue: past
                            ? `Expired on ${formatDate(doc.expiresAt)}. Renew it before the deadline.`
                            : `Expires ${formatDate(doc.expiresAt)}, before the deadline. Renew it first.`,
                    };
                }
                return {
                    ...base,
                    vaultDoc: doc,
                    status: 'ready',
                    note: `${doc.fileName}${doc.expiresAt ? ` · valid to ${formatDate(doc.expiresAt)}` : ''}`,
                };
            }

            case 'bid': {
                if (!pr.fileName) return { ...base, status: 'missing', note: 'Not uploaded yet', issue: 'Upload the file.' };
                if (wrongFormat) return { ...base, status: 'problem', note: pr.fileName, issue: formatIssue };
                return { ...base, status: 'ready', note: `${pr.fileName}${pr.uploadedBy ? ` · ${pr.uploadedBy}` : ''}` };
            }

            case 'form': {
                const fields = formFields(item, pr);
                const done = fields.filter((f) => f.value.trim()).length;
                const filled = { done, total: fields.length };
                const complete = done === fields.length;
                const touched = !!pr.fields || !!pr.fileName;

                if (pr.fileName && wrongFormat) return { ...base, filled, status: 'problem', note: pr.fileName, issue: formatIssue };
                if (!complete) {
                    return {
                        ...base,
                        filled,
                        status: touched ? 'in_progress' : 'missing',
                        note: `${done} of ${fields.length} fields filled${done && !touched ? ' by EBIS' : ''}`,
                        issue: `Fill in the ${fields.length - done} remaining field${fields.length - done > 1 ? 's' : ''}.`,
                    };
                }
                if (!touched) {
                    // EBIS filled every field, but a person has to check it before it counts.
                    return {
                        ...base,
                        filled,
                        status: 'in_progress',
                        note: 'Filled in by EBIS · not checked yet',
                        issue: 'Open it, check the details and save.',
                    };
                }
                if (item.signature && !pr.fileName) {
                    return {
                        ...base,
                        filled,
                        status: 'in_progress',
                        note: 'Filled in · waiting for the signed copy',
                        issue: 'Download, sign and upload the signed copy.',
                    };
                }
                return {
                    ...base,
                    filled,
                    status: 'ready',
                    note: pr.fileName ? `Signed copy: ${pr.fileName}` : 'All fields complete',
                };
            }
        }
    });
}

export function checklistCounts(resolved: ResolvedItem[]): Record<ChecklistStatus, number> {
    const counts = { ready: 0, in_progress: 0, missing: 0, problem: 0, not_applicable: 0 };
    resolved.forEach((r) => counts[r.status]++);
    return counts;
}
