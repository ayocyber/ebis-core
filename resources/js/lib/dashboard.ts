/**
 * Dashboard roll-ups across every live tender and the evidence vault.
 * Pure functions over the same data the tender pages use, so the numbers match.
 */
import { checklistFor } from '@/data/mock-checklist';
import type { WorkspaceView } from '@/hooks/use-tender-workspace';
import { resolveChecklist } from '@/lib/checklist';
import { recommend } from '@/lib/decision';
import { daysUntil, formatDate, stageIndex, stageRoute } from '@/lib/ebis';
import { readinessIssues, readinessScore } from '@/lib/readiness';
import { expiryState, usageFor } from '@/lib/vault';
import type { MissingEvidence, Tender, VaultDocument } from '@/types/ebis';

export type AttentionTone = 'critical' | 'warning' | 'info';

export interface AttentionItem {
    id: string;
    tone: AttentionTone;
    title: string;
    detail: string;
    action: string;
    href: string;
    tender?: Tender;
    /** Lower sorts first within a tone */
    order: number;
}

export const attentionMeta: Record<AttentionTone, { label: string; dot: string; text: string }> = {
    critical: { label: 'Urgent', dot: 'bg-status-not-met', text: 'text-status-not-met' },
    warning: { label: 'Soon', dot: 'bg-status-partial', text: 'text-status-partial' },
    info: { label: 'To do', dot: 'bg-primary', text: 'text-primary' },
};

const toneRank: Record<AttentionTone, number> = { critical: 0, warning: 1, info: 2 };

/** Eligibility has run, so gaps and decisions exist. */
export const isAssessed = (t: Tender) => stageIndex(t.stage) >= stageIndex('eligibility');

/** Writing has started, so a readiness score means something. */
export const isDrafting = (t: Tender) => stageIndex(t.stage) >= stageIndex('drafting');

/** Same score as the readiness page: gaps, decision, sections and the documents checklist. */
export function tenderReadiness(view: WorkspaceView, tender: Tender, documents: VaultDocument[]): number {
    const checklist = resolveChecklist(checklistFor(tender.id), view.checklist, { tender, supplier: '', documents, sections: view.sections });
    return readinessScore(readinessIssues(view.rows, view.sections, view.decision, checklist));
}

export function openGaps(view: WorkspaceView) {
    return view.rows.filter((r) => r.gap && r.gap.status !== 'closed');
}

export function attentionItems(
    tenders: Tender[],
    views: Record<string, WorkspaceView>,
    documents: VaultDocument[],
    missing: MissingEvidence[],
    now = new Date(),
): AttentionItem[] {
    const items: AttentionItem[] = [];
    const tenderRoute = (name: string, t: Tender) => route(name, { tender: t.id });

    for (const t of tenders) {
        if (t.stage === 'submitted' || views[t.id]?.signedOff) continue;
        const view = views[t.id];
        const days = daysUntil(t.deadline, now);

        // Closing very soon
        if (days >= 0 && days <= 7) {
            const score = isDrafting(t) ? tenderReadiness(view, t, documents) : undefined;
            items.push({
                id: `due-${t.id}`,
                tone: 'critical',
                title: `${t.buyer.name} bid is due in ${days} day${days === 1 ? '' : 's'}`,
                detail:
                    score !== undefined ? `Readiness is ${score}%. Fix the critical issues before sign-off.` : `Deadline ${formatDate(t.deadline)}.`,
                action: score !== undefined ? 'Check readiness' : 'Open bid',
                href: tenderRoute(score !== undefined ? 'tenders.validation' : stageRoute(t.stage), t),
                tender: t,
                order: days,
            });
        }

        if (isAssessed(t)) {
            const rec = recommend(view.rows, t, now);
            if (rec.lateBlockers.length) {
                const n = rec.lateBlockers.length;
                items.push({
                    id: `late-${t.id}`,
                    tone: 'critical',
                    title: `${n} blocker${n > 1 ? 's' : ''} can’t be closed in time for ${t.reference}`,
                    detail: rec.lateBlockers.map((r) => r.gap!.title).join(' · '),
                    action: 'View gaps',
                    href: tenderRoute('tenders.gaps', t),
                    tender: t,
                    order: days,
                });
            }

            const awaitingDecision = !view.decision && stageIndex(t.stage) <= stageIndex('decision');
            if (awaitingDecision && t.stage !== 'eligibility') {
                items.push({
                    id: `decide-${t.id}`,
                    tone: 'warning',
                    title: `Go / No-Go needed for ${t.buyer.name}`,
                    detail: `EBIS recommends: ${rec.headline}`,
                    action: 'Decide',
                    href: tenderRoute('tenders.decision', t),
                    tender: t,
                    order: days,
                });
            }
        }

        if (t.stage === 'eligibility') {
            items.push({
                id: `elig-${t.id}`,
                tone: 'info',
                title: `Eligibility check ready for ${t.reference}`,
                detail: t.eligibilityScore !== undefined ? `${t.eligibilityScore}% of requirements met. Review the results.` : 'Review the results.',
                action: 'Review',
                href: tenderRoute('tenders.eligibility', t),
                tender: t,
                order: days,
            });
        }

        if (t.stage === 'requirements') {
            items.push({
                id: `reqs-${t.id}`,
                tone: 'info',
                title: `Requirements ready to check for ${t.reference}`,
                detail: 'EBIS has pulled out the requirements. Confirm them to run the eligibility check.',
                action: 'Check',
                href: tenderRoute(stageRoute(t.stage), t),
                tender: t,
                order: days,
            });
        }

        if (t.clarificationDeadline) {
            const cd = daysUntil(t.clarificationDeadline, now);
            if (cd >= 0 && cd <= 14) {
                items.push({
                    id: `clar-${t.id}`,
                    tone: cd <= 3 ? 'critical' : 'warning',
                    title: `Clarification questions close in ${cd} day${cd === 1 ? '' : 's'}`,
                    detail: `${t.reference} · send questions to ${t.buyer.name} by ${formatDate(t.clarificationDeadline)}.`,
                    action: 'Open bid',
                    href: tenderRoute(stageRoute(t.stage), t),
                    tender: t,
                    order: cd,
                });
            }
        }
    }

    // Vault: expired documents that live bids depend on
    const expired = documents.filter((d) => expiryState(d, now).state === 'expired');
    const blocking = expired.filter((d) => usageFor(d.factIds).length > 0);
    if (blocking.length) {
        const bids = new Set(blocking.flatMap((d) => usageFor(d.factIds).map((u) => u.tender.id))).size;
        items.push({
            id: 'vault-expired',
            tone: 'critical',
            title: `${blocking.length} expired document${blocking.length > 1 ? 's' : ''} affect${blocking.length > 1 ? '' : 's'} ${bids} live bid${bids > 1 ? 's' : ''}`,
            detail: blocking.map((d) => d.title).join(' · '),
            action: 'Renew',
            href: route('vault.index'),
            order: 0,
        });
    }
    if (missing.length) {
        items.push({
            id: 'vault-missing',
            tone: 'warning',
            title: `${missing.length} document${missing.length > 1 ? 's' : ''} tenders ask for ${missing.length > 1 ? 'are' : 'is'} missing`,
            detail: missing.map((m) => m.title).join(' · '),
            action: 'Upload',
            href: route('vault.index'),
            order: 50,
        });
    }

    return items.sort((a, b) => toneRank[a.tone] - toneRank[b.tone] || a.order - b.order);
}

export function greeting(now = new Date()): string {
    const h = now.getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
