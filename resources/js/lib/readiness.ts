import { submissionRules } from '@/data/mock-requirements';
import type { ResolvedItem } from '@/lib/checklist';
import { buildComplianceRows } from '@/lib/compliance';
import { checkRules, findContradictions } from '@/lib/consistency';
import type { BidSection, EligibilityRow, GoNoGoDecision, ReadinessIssue } from '@/types/ebis';

export type Priority = ReadinessIssue['priority'];
export type FixTarget = 'gaps' | 'decision' | 'compliance' | 'bid' | 'documents';

export interface Issue extends ReadinessIssue {
    fix: FixTarget;
    fixLabel: string;
}

export const priorityMeta: Record<Priority, { label: string; hint: string; weight: number; dot: string; text: string }> = {
    critical: { label: 'Critical', hint: 'Would get the bid rejected', weight: 15, dot: 'bg-status-not-met', text: 'text-status-not-met' },
    high: { label: 'High', hint: 'Unfinished work', weight: 8, dot: 'bg-status-partial', text: 'text-status-partial' },
    medium: { label: 'Medium', hint: 'Could cost you marks', weight: 4, dot: 'bg-primary', text: 'text-primary' },
    low: { label: 'Low', hint: 'Nice to fix', weight: 1, dot: 'bg-status-unknown', text: 'text-muted-foreground' },
};

export const priorityOrder: Priority[] = ['critical', 'high', 'medium', 'low'];

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Everything standing between the bid and a clean submission. */
export function readinessIssues(rows: EligibilityRow[], sections: BidSection[], decision?: GoNoGoDecision, documents: ResolvedItem[] = []): Issue[] {
    const issues: Issue[] = [];
    const add = (i: Omit<Issue, 'id'>) => issues.push({ id: `iss-${issues.length + 1}`, ...i });

    if (!decision) {
        add({ priority: 'critical', message: 'No Go / No-Go decision has been recorded.', fix: 'decision', fixLabel: 'Decide' });
    } else if (decision.outcome === 'decline') {
        add({ priority: 'critical', message: 'The recorded decision is not to bid.', fix: 'decision', fixLabel: 'Review' });
    }

    for (const r of rows) {
        const g = r.gap;
        if (!g || g.status === 'closed') continue;
        // An open mandatory gap at submission fails the bid, however quick it would be to fix.
        if (g.severity === 'blocker' || r.requirement.category === 'mandatory')
            add({
                priority: 'critical',
                requirementId: r.requirement.id,
                message: `${r.requirement.code} · ${g.title} is still open.`,
                fix: 'gaps',
                fixLabel: 'Close gap',
            });
        else if (g.severity === 'fixable')
            add({
                priority: 'medium',
                requirementId: r.requirement.id,
                message: `${r.requirement.code} · ${g.title} is still open.`,
                fix: 'gaps',
                fixLabel: 'Close gap',
            });
        else add({ priority: 'low', requirementId: r.requirement.id, message: `${r.requirement.code} · ${g.title}.`, fix: 'gaps', fixLabel: 'Open' });
    }

    for (const r of buildComplianceRows(rows, sections, {})) {
        if (!r.section && r.requirement.category !== 'informational')
            add({
                priority: r.requirement.category === 'mandatory' ? 'critical' : 'high',
                requirementId: r.requirement.id,
                message: `${r.requirement.code} · ${r.requirement.title} isn’t answered in any section.`,
                fix: 'compliance',
                fixLabel: 'Map it',
            });
    }

    for (const s of sections) {
        for (const w of s.warnings)
            add({
                priority: w.severity === 'error' ? 'critical' : 'medium',
                sectionId: s.id,
                message: `${s.title}: “${w.excerpt}” — ${w.message}`,
                fix: 'bid',
                fixLabel: 'Edit',
            });
        if (s.wordLimit && words(s.body) > s.wordLimit)
            add({
                priority: 'high',
                sectionId: s.id,
                message: `${s.title} is over its ${s.wordLimit.toLocaleString()}-word limit.`,
                fix: 'bid',
                fixLabel: 'Trim',
            });
        if (!s.body.trim()) add({ priority: 'high', sectionId: s.id, message: `${s.title} hasn’t been written.`, fix: 'bid', fixLabel: 'Write' });
        else if (s.status !== 'complete')
            add({ priority: 'high', sectionId: s.id, message: `${s.title} is not marked complete.`, fix: 'bid', fixLabel: 'Finish' });
    }

    // VAL-05: sections that disagree with each other
    for (const c of findContradictions(sections))
        add({
            priority: 'high',
            sectionId: c.b.sectionId,
            message: `${c.topic} doesn’t match: “${c.a.excerpt}” in ${c.a.sectionTitle}, but “${c.b.excerpt}” in ${c.b.sectionTitle}.`,
            fix: 'bid',
            fixLabel: 'Fix',
        });

    // VAL-03: file size and page limits (formats and word limits are reported above / by the checklist)
    for (const check of checkRules(submissionRules(), sections, documents)) {
        if (check.rule.id !== 'r-size' && check.rule.id !== 'r-pages') continue;
        for (const b of check.breaches) {
            if (check.rule.id === 'r-pages' && b.message.includes('-word limit')) continue;
            add({
                priority: check.rule.id === 'r-size' ? 'critical' : 'high',
                message: `${b.where}: ${b.message} (${check.rule.source})`,
                fix: b.fix,
                fixLabel: 'Fix',
            });
        }
    }

    // VAL-02: required forms complete, required documents attached (the written response is covered above)
    for (const d of documents) {
        if (d.item.kind === 'response') continue;
        const t = d.item.title;
        if (d.status === 'problem') add({ priority: 'critical', message: `${t}: ${d.issue}`, fix: 'documents', fixLabel: 'Fix' });
        else if (d.status === 'missing' && d.item.need === 'conditional')
            add({ priority: 'medium', message: `${t}: fill it in, or mark it as not needed.`, fix: 'documents', fixLabel: 'Confirm' });
        else if (d.status === 'missing') add({ priority: 'critical', message: `${t} is missing.`, fix: 'documents', fixLabel: 'Add' });
        else if (d.status === 'in_progress') add({ priority: 'high', message: `${t}: ${d.issue}`, fix: 'documents', fixLabel: 'Finish' });
    }

    return issues.sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority));
}

/** 100 with no issues; halves at 100 penalty points, so it never hits a misleading 0. */
export function readinessScore(issues: Issue[]): number {
    const penalty = issues.reduce((t, i) => t + priorityMeta[i.priority].weight, 0);
    return Math.round((100 * 100) / (100 + penalty));
}
