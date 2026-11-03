import { TenderHeader } from '@/components/ebis/tender-header';
import { TenderNotFound } from '@/components/ebis/tender-not-found';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { findTender } from '@/data/mock-ebis';
import { documentsRead, EXTRACTION_THRESHOLD, submissionRules } from '@/data/mock-requirements';
import { logEvent } from '@/hooks/use-audit';
import { type ReviewedRequirement, useRequirementsReview } from '@/hooks/use-requirements-review';
import AppLayout from '@/layouts/app-layout';
import { categoryMeta, topicLabels } from '@/lib/ebis';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { RequirementCategory, RequirementTopic } from '@/types/ebis';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    Check,
    CheckCircle2,
    FileScan,
    FileSpreadsheet,
    FileText,
    Loader2,
    Pencil,
    Plus,
    Quote,
    ScrollText,
    Sparkles,
    Trash2,
    Undo2,
} from 'lucide-react';
import { useState } from 'react';

const categories: RequirementCategory[] = ['mandatory', 'scored', 'informational'];
type Filter = 'all' | 'check' | 'edited';

export default function TenderRequirements({ tenderId }: { tenderId: string }) {
    const { role, auth } = usePage<SharedData>().props;
    const tender = findTender(tenderId);
    const { state, requirements, fields, update } = useRequirementsReview(tenderId, tender);
    const [filter, setFilter] = useState<Filter>('all');
    const [editing, setEditing] = useState<ReviewedRequirement | 'new' | null>(null);
    const [running, setRunning] = useState(false);
    const editable = canEdit(role);

    if (!tender) return <TenderNotFound />;

    const live = requirements.filter((r) => !r.deleted);
    const flagged = (r: ReviewedRequirement) => r.extractionConfidence < EXTRACTION_THRESHOLD && !r.checked && !r.edited && !r.deleted;
    const toCheck = requirements.filter(flagged);
    const missingFields = fields.filter((f) => f.required && !f.value.trim());
    const docs = documentsRead(tender);
    const problems = docs.flatMap((d) => d.problems.map((p) => ({ ...p, doc: d.name })));
    const problemsOpen = problems.filter((p) => !state.problemsChecked.includes(p.id));
    const ready = toCheck.length === 0 && missingFields.length === 0;
    const reading = tender.stage === 'extraction' || tender.stage === 'intake';

    const visible = requirements.filter((r) =>
        filter === 'check' ? flagged(r) : filter === 'edited' ? r.edited || r.deleted || r.id.startsWith('req-new') : true,
    );
    const scoredPts = live.filter((r) => r.category === 'scored').reduce((t, r) => t + (r.weight ?? 0), 0);

    const log = (action: string, target: string, detail?: string, by?: string) =>
        logEvent({
            category: 'requirements',
            action,
            target: target === tender.reference ? target : `${tender.reference} · ${target}`,
            tenderId: tender.id,
            detail,
            by,
        });

    const run = () => {
        setRunning(true);
        window.setTimeout(() => {
            update((s) => ({ ...s, confirmed: { by: auth.user.name, at: new Date().toISOString(), count: live.length } }));
            const changes = [
                state.added.length && `${state.added.length} added`,
                state.deleted.length && `${state.deleted.length} removed`,
                Object.keys(state.edits).length && `${Object.keys(state.edits).length} edited`,
                Object.keys(state.fields).length && `${Object.keys(state.fields).length} tender details corrected`,
            ].filter(Boolean);
            log('confirmed the requirements for', tender.reference, [`${live.length} requirements`, ...changes].join(' · '));
            log('ran the eligibility check on', tender.reference, `${live.length} requirements checked against the company profile`, 'EBIS');
            setRunning(false);
        }, 1600);
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference, href: `/tenders/${tender.id}/requirements` },
                { title: 'Requirements', href: `/tenders/${tender.id}/requirements` },
            ]}
        >
            <Head title={`Requirements · ${tender.reference}`} />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <TenderHeader
                    tender={tender}
                    viewing="requirements"
                    actions={
                        state.confirmed ? (
                            <Button size="sm" asChild>
                                <Link href={route('tenders.eligibility', tender.id)}>
                                    See eligibility <ArrowRight className="size-4" />
                                </Link>
                            </Button>
                        ) : undefined
                    }
                />

                {reading && (
                    <div className="border-primary/30 bg-primary/[0.04] animate-fade-up flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
                        <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
                        <p>
                            <span className="font-medium">EBIS is still reading this pack.</span>{' '}
                            <span className="text-muted-foreground">You can start checking what it has found so far.</span>
                        </p>
                    </div>
                )}

                {/* Intro + summary */}
                <section className="animate-fade-up flex flex-col gap-4 [animation-delay:60ms] lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold tracking-tight">Check what EBIS found</h2>
                        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
                            EBIS read the tender pack and pulled out every requirement with the clause it came from. Fix anything it got wrong before
                            the eligibility check runs. Items it wasn’t sure about are flagged.
                        </p>
                    </div>
                    <dl className="flex flex-wrap gap-2 text-xs">
                        <Stat label="Requirements" value={live.length} />
                        <Stat label="Mandatory" value={live.filter((r) => r.category === 'mandatory').length} />
                        <Stat label="Scored" value={`${live.filter((r) => r.category === 'scored').length} · ${scoredPts} pts`} />
                        <Stat label="To check" value={toCheck.length} tone={toCheck.length ? 'warn' : 'ok'} />
                    </dl>
                </section>

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
                    {/* Requirements */}
                    <div className="min-w-0 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="bg-muted inline-flex rounded-lg p-1 text-sm" role="tablist" aria-label="Filter requirements">
                                {(
                                    [
                                        ['all', `All ${requirements.length}`],
                                        ['check', `To check ${toCheck.length}`],
                                        ['edited', 'Your changes'],
                                    ] as [Filter, string][]
                                ).map(([id, label]) => (
                                    <button
                                        key={id}
                                        role="tab"
                                        aria-selected={filter === id}
                                        onClick={() => setFilter(id)}
                                        className={cn(
                                            'rounded-md px-3 py-1.5 font-medium transition-all',
                                            filter === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {editable && (
                                <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
                                    <Plus className="size-4" /> Add a requirement
                                </Button>
                            )}
                        </div>

                        {categories.map((cat) => {
                            const group = visible.filter((r) => r.category === cat);
                            if (!group.length) return null;
                            return (
                                <section key={cat} aria-labelledby={`cat-${cat}`} className="bg-card overflow-hidden rounded-2xl border">
                                    <header className="bg-muted/30 flex items-baseline justify-between gap-3 border-b px-5 py-3">
                                        <h3 id={`cat-${cat}`} className="text-sm font-semibold">
                                            {categoryMeta[cat].label}{' '}
                                            <span className="text-muted-foreground font-normal tabular-nums">
                                                {group.filter((r) => !r.deleted).length}
                                            </span>
                                        </h3>
                                        <p className="text-muted-foreground hidden text-xs sm:block">{categoryMeta[cat].description}</p>
                                    </header>
                                    <ul className="divide-y">
                                        {group.map((r) => (
                                            <RequirementRow
                                                key={r.id}
                                                r={r}
                                                flagged={flagged(r)}
                                                editable={editable && !state.confirmed}
                                                onCheck={() => {
                                                    update((s) => ({ ...s, checked: [...s.checked, r.id] }));
                                                    log('confirmed a flagged requirement in', `${r.code} · ${r.title}`);
                                                }}
                                                onEdit={() => setEditing(r)}
                                                onDelete={() => {
                                                    update((s) => ({ ...s, deleted: [...s.deleted, r.id] }));
                                                    log('removed a requirement from', `${r.code} · ${r.title}`);
                                                }}
                                                onRestore={() => {
                                                    update((s) => ({ ...s, deleted: s.deleted.filter((x) => x !== r.id) }));
                                                    log('restored a requirement in', `${r.code} · ${r.title}`);
                                                }}
                                            />
                                        ))}
                                    </ul>
                                </section>
                            );
                        })}

                        {!visible.length && (
                            <div className="bg-card flex flex-col items-center gap-2 rounded-2xl border px-6 py-12 text-center">
                                <CheckCircle2 className="text-status-met size-8" />
                                <p className="font-medium">{filter === 'check' ? 'Nothing left to check' : 'No changes yet'}</p>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-4 lg:sticky lg:top-20">
                        <ConfirmCard
                            confirmed={state.confirmed}
                            running={running}
                            ready={ready}
                            toCheck={toCheck.length}
                            missingFields={missingFields.map((f) => f.label)}
                            count={live.length}
                            editable={editable}
                            tenderId={tender.id}
                            onRun={run}
                        />

                        {/* Tender details (ING-04) */}
                        <section className="bg-card rounded-2xl border" aria-labelledby="details-title">
                            <div className="border-b px-5 py-3.5">
                                <h3 id="details-title" className="text-sm font-semibold">
                                    Tender details
                                </h3>
                                <p className="text-muted-foreground text-xs">Read from the pack. Correct anything that’s wrong.</p>
                            </div>
                            <div className="space-y-3 p-5">
                                {fields.map((f) => (
                                    <label key={f.key} className="block space-y-1">
                                        <span className="flex items-center justify-between gap-2 text-xs">
                                            <span className="font-medium">
                                                {f.label}
                                                {f.required && <span className="text-status-not-met"> *</span>}
                                            </span>
                                            <span
                                                className={cn(
                                                    'text-[11px]',
                                                    f.edited ? 'text-foreground' : f.source ? 'text-muted-foreground' : 'text-status-partial',
                                                )}
                                            >
                                                {f.edited ? 'Edited by you' : f.source ? `From ${f.source}` : 'Not found — add it'}
                                            </span>
                                        </span>
                                        <Input
                                            type={f.input ?? 'text'}
                                            value={f.value}
                                            disabled={!editable || !!state.confirmed}
                                            onChange={(e) => update((s) => ({ ...s, fields: { ...s.fields, [f.key]: e.target.value } }))}
                                            className={cn('h-9', f.required && !f.value.trim() && 'border-status-not-met/60')}
                                        />
                                    </label>
                                ))}
                            </div>
                        </section>

                        {/* Reading report (ING-02 / TUN-06) */}
                        <section className="bg-card rounded-2xl border" aria-labelledby="read-title">
                            <div className="border-b px-5 py-3.5">
                                <h3 id="read-title" className="text-sm font-semibold">
                                    What EBIS read
                                </h3>
                                <p className="text-muted-foreground text-xs">
                                    {problems.length
                                        ? `${problemsOpen.length} part${problemsOpen.length === 1 ? '' : 's'} couldn’t be read reliably`
                                        : 'Every page was read'}
                                </p>
                            </div>
                            <ul className="divide-y">
                                {docs.map((d) => {
                                    const Icon = d.method === 'spreadsheet' ? FileSpreadsheet : d.method === 'ocr' ? FileScan : FileText;
                                    return (
                                        <li key={d.id} className="space-y-2 px-5 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <Icon className="text-muted-foreground size-4 shrink-0" />
                                                <p className="min-w-0 flex-1 truncate text-sm" title={d.name}>
                                                    {d.name}
                                                </p>
                                                {d.problems.length ? (
                                                    <AlertTriangle className="text-status-partial size-4 shrink-0" aria-label="Has problems" />
                                                ) : (
                                                    <Check className="text-status-met size-4 shrink-0" aria-label="Read" />
                                                )}
                                            </div>
                                            <p className="text-muted-foreground pl-6.5 text-[11px]">
                                                {d.pages ? `${d.pages} pages · ` : ''}
                                                {d.method === 'ocr' ? 'Scanned, read with OCR' : d.method === 'spreadsheet' ? 'Spreadsheet' : 'Text'}
                                            </p>
                                            {d.problems.map((p) => {
                                                const seen = state.problemsChecked.includes(p.id);
                                                return (
                                                    <div
                                                        key={p.id}
                                                        className={cn(
                                                            'ml-6.5 space-y-1.5 rounded-lg border p-2.5 text-xs',
                                                            seen ? 'bg-muted/40' : 'border-status-partial/30 bg-status-partial/[0.06]',
                                                        )}
                                                    >
                                                        <p className="font-medium">{p.location}</p>
                                                        <p className="text-muted-foreground leading-relaxed">{p.problem}</p>
                                                        {editable &&
                                                            (seen ? (
                                                                <p className="text-status-met flex items-center gap-1 font-medium">
                                                                    <Check className="size-3.5" /> Checked
                                                                </p>
                                                            ) : (
                                                                <button
                                                                    onClick={() =>
                                                                        update((s) => ({ ...s, problemsChecked: [...s.problemsChecked, p.id] }))
                                                                    }
                                                                    className="text-primary font-medium hover:underline"
                                                                >
                                                                    I’ve checked this part myself
                                                                </button>
                                                            ))}
                                                    </div>
                                                );
                                            })}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>

                        {/* Submission rules (TUN-04) */}
                        <section className="bg-card rounded-2xl border" aria-labelledby="rules-title">
                            <div className="border-b px-5 py-3.5">
                                <h3 id="rules-title" className="flex items-center gap-2 text-sm font-semibold">
                                    <ScrollText className="text-muted-foreground size-4" /> Submission rules
                                </h3>
                                <p className="text-muted-foreground text-xs">Checked again before you sign off.</p>
                            </div>
                            <dl className="divide-y">
                                {submissionRules().map((r) => (
                                    <div key={r.id} className="px-5 py-2.5">
                                        <dt className="text-muted-foreground flex justify-between gap-2 text-[11px]">
                                            {r.label} <span>{r.source}</span>
                                        </dt>
                                        <dd className="mt-0.5 text-sm">{r.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    </aside>
                </div>
            </div>

            <RequirementDialog
                target={editing}
                tenderId={tender.id}
                nextCode={(cat) => {
                    const prefix = cat === 'mandatory' ? 'M' : cat === 'scored' ? 'S' : 'I';
                    const n = requirements.filter((r) => r.code.startsWith(`${prefix}-`)).length + 1;
                    return `${prefix}-${String(n).padStart(2, '0')}`;
                }}
                onClose={() => setEditing(null)}
                onSave={(saved) => {
                    if (editing === 'new') {
                        update((s) => ({ ...s, added: [...s.added, saved as ReviewedRequirement] }));
                        log('added a requirement to', `${saved.code} · ${saved.title}`);
                    } else if (editing) {
                        update((s) => ({ ...s, edits: { ...s.edits, [editing.id]: { ...s.edits[editing.id], ...saved } } }));
                        const was = editing.title !== saved.title ? `“${editing.title}” → “${saved.title}”` : undefined;
                        log('edited a requirement in', `${editing.code} · ${saved.title}`, was);
                    }
                    setEditing(null);
                }}
            />
        </AppLayout>
    );
}

/* ------------------------------------------------------------------ */

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warn' }) {
    return (
        <div
            className={cn(
                'bg-card rounded-lg border px-3 py-2',
                tone === 'warn' && 'border-status-partial/40 bg-status-partial/[0.06]',
                tone === 'ok' && 'border-status-met/30',
            )}
        >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-foreground text-base font-semibold tabular-nums">{value}</dd>
        </div>
    );
}

function RequirementRow({
    r,
    flagged,
    editable,
    onCheck,
    onEdit,
    onDelete,
    onRestore,
}: {
    r: ReviewedRequirement;
    flagged: boolean;
    editable: boolean;
    onCheck: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onRestore: () => void;
}) {
    const pct = Math.round(r.extractionConfidence * 100);
    const isNew = r.id.startsWith('req-new');

    if (r.deleted) {
        return (
            <li className="bg-muted/30 flex items-center gap-3 px-5 py-3 text-sm">
                <span className="text-muted-foreground font-mono text-xs">{r.code}</span>
                <span className="text-muted-foreground min-w-0 flex-1 truncate line-through">{r.title}</span>
                <span className="text-muted-foreground text-xs">Removed</span>
                {editable && (
                    <Button size="sm" variant="ghost" onClick={onRestore}>
                        <Undo2 className="size-4" /> Undo
                    </Button>
                )}
            </li>
        );
    }

    return (
        <li className={cn('group flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start', flagged && 'bg-status-partial/[0.04]')}>
            <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-muted-foreground font-mono text-xs font-medium">{r.code}</span>
                    <p className="font-medium">{r.title}</p>
                    {r.weight ? <span className="text-muted-foreground text-xs tabular-nums">{r.weight} pts</span> : null}
                    {flagged ? (
                        <span
                            className="bg-status-partial/10 text-status-partial ring-status-partial/25 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                            title="EBIS isn’t sure it read this correctly"
                        >
                            Check this · {pct}%
                        </span>
                    ) : isNew ? (
                        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium">Added by you</span>
                    ) : r.edited ? (
                        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">Edited</span>
                    ) : r.checked ? (
                        <span className="text-status-met flex items-center gap-1 text-[11px] font-medium">
                            <Check className="size-3" /> Checked
                        </span>
                    ) : null}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{r.text}</p>
                {r.source.quote && (
                    <blockquote className="text-muted-foreground border-border flex gap-2 border-l-2 pl-3 text-xs leading-relaxed italic">
                        <Quote className="mt-0.5 size-3 shrink-0 not-italic opacity-60" />
                        <span className="line-clamp-2">{r.source.quote}</span>
                    </blockquote>
                )}
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="flex items-center gap-1">
                        <FileText className="size-3" />
                        {[
                            isNew ? 'Your entry' : r.source.documentName.replace(/\.[^.]+$/, ''),
                            r.source.page ? `p.${r.source.page}` : '',
                            r.source.section ?? '',
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                    <span>{topicLabels[r.topic]}</span>
                    {!flagged && !isNew && <span className="tabular-nums">Read with {pct}% confidence</span>}
                </p>
            </div>

            {editable && (
                <div className="flex shrink-0 items-center gap-1 sm:pt-0.5">
                    {flagged && (
                        <Button size="sm" variant="outline" onClick={onCheck}>
                            <Check className="size-4" /> Looks right
                        </Button>
                    )}
                    <Button size="icon" variant="ghost" className="size-8" onClick={onEdit} aria-label={`Edit ${r.code}`}>
                        <Pencil className="size-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="hover:text-status-not-met size-8"
                        onClick={onDelete}
                        aria-label={`Remove ${r.code}`}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            )}
        </li>
    );
}

function ConfirmCard({
    confirmed,
    running,
    ready,
    toCheck,
    missingFields,
    count,
    editable,
    tenderId,
    onRun,
}: {
    confirmed?: { by: string; at: string; count: number };
    running: boolean;
    ready: boolean;
    toCheck: number;
    missingFields: string[];
    count: number;
    editable: boolean;
    tenderId: string;
    onRun: () => void;
}) {
    if (confirmed) {
        return (
            <section className="border-status-met/30 bg-status-met/[0.06] animate-fade-up space-y-3 rounded-2xl border p-5">
                <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="text-status-met size-5" /> Eligibility check done
                </p>
                <p className="text-muted-foreground text-sm">
                    {confirmed.count} requirements confirmed by {confirmed.by} and checked against your company profile.
                </p>
                <Button asChild className="w-full">
                    <Link href={route('tenders.eligibility', tenderId)}>
                        See the results <ArrowRight className="size-4" />
                    </Link>
                </Button>
            </section>
        );
    }

    return (
        <section className="bg-card space-y-3 rounded-2xl border p-5 shadow-[0_20px_60px_-40px_var(--glow)]">
            <p className="flex items-center gap-2 font-semibold">
                <Sparkles className="text-primary size-4" /> Ready to check eligibility?
            </p>
            <ul className="space-y-1.5 text-sm">
                <Todo
                    done={toCheck === 0}
                    text={toCheck ? `${toCheck} flagged requirement${toCheck > 1 ? 's' : ''} to check` : 'Flagged items checked'}
                />
                <Todo
                    done={missingFields.length === 0}
                    text={missingFields.length ? `Add the ${missingFields.join(', ').toLowerCase()}` : 'Deadline and details in place'}
                />
            </ul>
            <Button className="h-11 w-full rounded-lg" disabled={!ready || running || !editable} onClick={onRun}>
                {running ? (
                    <>
                        <Loader2 className="size-4 animate-spin" /> Checking {count} requirements…
                    </>
                ) : (
                    <>
                        Confirm {count} requirements <ArrowRight className="size-4" />
                    </>
                )}
            </Button>
            <p className="text-muted-foreground text-xs">EBIS then checks each one against your company profile and evidence vault.</p>
        </section>
    );
}

function Todo({ done, text }: { done: boolean; text: string }) {
    return (
        <li className={cn('flex items-start gap-2', done ? 'text-muted-foreground' : 'text-foreground')}>
            {done ? (
                <CheckCircle2 className="text-status-met mt-0.5 size-4 shrink-0" />
            ) : (
                <AlertTriangle className="text-status-partial mt-0.5 size-4 shrink-0" />
            )}
            {text}
        </li>
    );
}

/* ------------------------------------------------------------------ */

const topics = Object.keys(topicLabels) as RequirementTopic[];
const selectClass =
    'border-input bg-background focus-visible:ring-ring/50 flex h-10 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none';

function RequirementDialog({
    target,
    tenderId,
    nextCode,
    onClose,
    onSave,
}: {
    target: ReviewedRequirement | 'new' | null;
    tenderId: string;
    nextCode: (c: RequirementCategory) => string;
    onClose: () => void;
    onSave: (r: Partial<ReviewedRequirement>) => void;
}) {
    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                {target && (
                    <RequirementForm
                        key={target === 'new' ? 'new' : target.id}
                        target={target}
                        tenderId={tenderId}
                        nextCode={nextCode}
                        onCancel={onClose}
                        onSave={onSave}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function RequirementForm({
    target,
    tenderId,
    nextCode,
    onCancel,
    onSave,
}: {
    target: ReviewedRequirement | 'new';
    tenderId: string;
    nextCode: (c: RequirementCategory) => string;
    onCancel: () => void;
    onSave: (r: Partial<ReviewedRequirement>) => void;
}) {
    const isNew = target === 'new';
    const [title, setTitle] = useState(isNew ? '' : target.title);
    const [text, setText] = useState(isNew ? '' : target.text);
    const [category, setCategory] = useState<RequirementCategory>(isNew ? 'mandatory' : target.category);
    const [topic, setTopic] = useState<RequirementTopic>(isNew ? 'legal' : target.topic);
    const [weight, setWeight] = useState(isNew ? '' : String(target.weight ?? ''));
    const [page, setPage] = useState(isNew ? '' : String(target.source.page));
    const [section, setSection] = useState(isNew ? '' : (target.source.section ?? ''));

    const ok = title.trim() && text.trim() && (category !== 'scored' || Number(weight) > 0);

    const save = () => {
        const base = {
            title: title.trim(),
            text: text.trim(),
            category,
            topic,
            weight: category === 'scored' ? Number(weight) : undefined,
        };
        if (isNew) {
            onSave({
                ...base,
                id: `req-new-${Date.now()}`,
                tenderId,
                code: nextCode(category),
                extractionConfidence: 1,
                source: {
                    documentId: 'manual',
                    documentName: 'Added by you',
                    page: Number(page) || 0,
                    section: section || undefined,
                    quote: '',
                },
            });
        } else {
            onSave({ ...base, source: { ...target.source, page: Number(page) || target.source.page, section: section || undefined } });
        }
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>{isNew ? 'Add a requirement' : `Edit ${target.code}`}</DialogTitle>
                <DialogDescription>
                    {isNew ? 'Something EBIS missed. It will be checked like the others.' : 'Your change is kept with this tender’s history.'}
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Title</span>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Modern slavery statement" />
                </label>
                <label className="block space-y-1.5">
                    <span className="text-sm font-medium">What the tender asks for</span>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={3}
                        className="border-input bg-background focus-visible:ring-ring/50 w-full resize-none rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
                    />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">Type</span>
                        <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as RequirementCategory)}>
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {categoryMeta[c].label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">Topic</span>
                        <select className={selectClass} value={topic} onChange={(e) => setTopic(e.target.value as RequirementTopic)}>
                            {topics.map((t) => (
                                <option key={t} value={t}>
                                    {topicLabels[t]}
                                </option>
                            ))}
                        </select>
                    </label>
                    {category === 'scored' && (
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">Weight (points)</span>
                            <Input type="number" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} />
                        </label>
                    )}
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">Page</span>
                        <Input type="number" min={1} value={page} onChange={(e) => setPage(e.target.value)} />
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">Clause</span>
                        <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="§ 5.2" />
                    </label>
                </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button onClick={save} disabled={!ok}>
                    {isNew ? 'Add requirement' : 'Save changes'}
                </Button>
            </div>
        </>
    );
}
