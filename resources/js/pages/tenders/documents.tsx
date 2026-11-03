import { FormDialog } from '@/components/checklist/form-dialog';
import { TenderHeader } from '@/components/ebis/tender-header';
import { TenderNotFound } from '@/components/ebis/tender-not-found';
import { Button } from '@/components/ui/button';
import { type UploadTarget, UploadDialog } from '@/components/vault/upload-dialog';
import { findTender } from '@/data/mock-ebis';
import { useChecklist } from '@/hooks/use-checklist';
import AppLayout from '@/layouts/app-layout';
import {
    type ChecklistStatus,
    type ResolvedItem,
    checklistCounts,
    checklistKindMeta,
    checklistKindOrder,
    checklistStatusMeta,
    checklistStatusOrder,
    slug,
} from '@/lib/checklist';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { ChecklistProgress, MissingEvidence } from '@/types/ebis';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, FileText, FolderOpen, Info, PenLine, RefreshCw, Trash2, Undo2, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';

export default function TenderDocuments({ tenderId }: { tenderId: string }) {
    const { role, auth } = usePage<SharedData>().props;
    const tender = findTender(tenderId);
    const { documents, vault, supplier, updateChecklist } = useChecklist(tenderId, tender);
    const [filter, setFilter] = useState<ChecklistStatus | null>(null);
    const [formEntry, setFormEntry] = useState<ResolvedItem | null>(null);
    const [upload, setUpload] = useState<UploadTarget | null>(null);
    const editable = canEdit(role);

    if (!tender) return <TenderNotFound />;

    const counts = checklistCounts(documents);
    const needed = documents.length - counts.not_applicable;
    const pct = needed ? Math.round((counts.ready / needed) * 100) : 100;
    const visible = filter ? documents.filter((d) => d.status === filter) : documents;

    const save = (itemId: string, patch: ChecklistProgress | null) => updateChecklist(itemId, patch);

    const vaultUpload = (d: ResolvedItem) => {
        if (d.vaultDoc) return setUpload({ replace: d.vaultDoc });
        const known = vault.missing.find((m) => m.id === d.item.missingId);
        const missing: MissingEvidence = known ?? { id: `miss-${d.item.id}`, title: d.item.title, category: 'company', why: d.item.why };
        setUpload({ missing });
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference, href: `/tenders/${tender.id}/eligibility` },
                { title: 'Documents checklist', href: `/tenders/${tender.id}/documents` },
            ]}
        >
            <Head title={`Documents · ${tender.reference}`} />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <TenderHeader
                    tender={tender}
                    viewing="compliance"
                    actions={
                        <>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('tenders.compliance', tender.id)}>
                                    <ArrowLeft className="size-4" /> Compliance
                                </Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link href={route('tenders.validation', tender.id)}>
                                    Readiness <ArrowRight className="size-4" />
                                </Link>
                            </Button>
                        </>
                    }
                />

                {/* Summary */}
                <section className="bg-card animate-fade-up grid gap-6 rounded-2xl border p-5 [animation-delay:60ms] sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                    <div className="flex items-center gap-4">
                        <Ring value={pct} />
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Documents checklist</h2>
                            <p className="text-muted-foreground text-sm">
                                <span className="text-foreground font-medium tabular-nums">
                                    {counts.ready} of {needed}
                                </span>{' '}
                                ready to submit
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
                            {checklistStatusOrder
                                .filter((s) => counts[s] > 0)
                                .map((s) => {
                                    const meta = checklistStatusMeta[s];
                                    const on = filter === s;
                                    return (
                                        <button
                                            key={s}
                                            aria-pressed={on}
                                            onClick={() => setFilter(on ? null : s)}
                                            className={cn(
                                                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-all ring-inset',
                                                meta.pill,
                                                on && 'ring-2 ring-current',
                                                filter && !on && 'opacity-50',
                                            )}
                                        >
                                            <meta.icon className="size-3.5" />
                                            {meta.label}
                                            <span className="tabular-nums">{counts[s]}</span>
                                        </button>
                                    );
                                })}
                            {filter && (
                                <button
                                    onClick={() => setFilter(null)}
                                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-1 text-xs"
                                >
                                    <X className="size-3.5" /> Clear
                                </button>
                            )}
                        </div>
                        <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
                            <Info className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                                Read from the tender’s submission instructions (ITT §7). When EBIS builds the submission pack it renames every file to
                                the buyer’s rule:{' '}
                                <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[11px]">
                                    {slug(tender.reference)}_{slug(supplier)}_Document
                                </code>
                            </span>
                        </p>
                    </div>
                </section>

                {/* Groups */}
                {checklistKindOrder.map((kind, gi) => {
                    const group = visible.filter((d) => d.item.kind === kind);
                    if (!group.length) return null;
                    const meta = checklistKindMeta[kind];
                    const ready = documents.filter((d) => d.item.kind === kind && d.status === 'ready').length;
                    const total = documents.filter((d) => d.item.kind === kind && d.status !== 'not_applicable').length;
                    return (
                        <section
                            key={kind}
                            aria-labelledby={`grp-${kind}`}
                            className="animate-fade-up space-y-3"
                            style={{ animationDelay: `${120 + gi * 60}ms` }}
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <h3 id={`grp-${kind}`} className="font-semibold tracking-tight">
                                    {meta.label}{' '}
                                    <span className="text-muted-foreground text-sm font-normal tabular-nums">
                                        {ready}/{total}
                                    </span>
                                </h3>
                                <p className="text-muted-foreground text-xs">{meta.hint}</p>
                            </div>
                            <ul className="bg-card divide-y overflow-hidden rounded-2xl border">
                                {group.map((d) => (
                                    <Row
                                        key={d.item.id}
                                        entry={d}
                                        editable={editable}
                                        tenderId={tender.id}
                                        userName={auth.user.name}
                                        onFill={() => setFormEntry(d)}
                                        onVault={() => vaultUpload(d)}
                                        onSave={(patch) => save(d.item.id, patch)}
                                    />
                                ))}
                            </ul>
                        </section>
                    );
                })}

                {!visible.length && <p className="text-muted-foreground py-10 text-center text-sm">Nothing matches this filter.</p>}
            </div>

            <FormDialog
                entry={formEntry}
                userName={auth.user.name}
                onOpenChange={(o) => !o && setFormEntry(null)}
                onSave={(patch) => {
                    if (formEntry) save(formEntry.item.id, patch);
                    setFormEntry(null);
                }}
            />
            {upload && <UploadDialog open onOpenChange={(o) => !o && setUpload(null)} target={upload} />}
        </AppLayout>
    );
}

/* ------------------------------------------------------------------ */

function Row({
    entry: d,
    editable,
    tenderId,
    userName,
    onFill,
    onVault,
    onSave,
}: {
    entry: ResolvedItem;
    editable: boolean;
    tenderId: string;
    userName: string;
    onFill: () => void;
    onVault: () => void;
    onSave: (patch: ChecklistProgress | null) => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const meta = checklistStatusMeta[d.status];
    const { item } = d;
    const na = d.status === 'not_applicable';
    const showIssue = d.issue && d.status !== 'ready' && !na;

    const pickFile = () => input.current?.click();

    return (
        <li className={cn('flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:px-5', na && 'opacity-60')}>
            <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', meta.pill)}>
                <meta.icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className={cn('font-medium', na && 'line-through decoration-1')}>{item.title}</p>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', meta.pill)}>{meta.label}</span>
                    {item.need === 'conditional' && (
                        <span className="text-muted-foreground rounded-full border border-dashed px-2 py-0.5 text-[11px]">{item.condition}</span>
                    )}
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.why}</p>

                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="flex items-center gap-1">
                        <FileText className="size-3.5" /> {item.source}
                    </span>
                    <span className="font-mono text-[11px] uppercase">{item.formats.map((f) => `.${f}`).join(' / ')}</span>
                    {item.signature && (
                        <span className="flex items-center gap-1">
                            <PenLine className="size-3.5" /> Signature needed
                        </span>
                    )}
                </div>

                {d.filled && !na && d.status !== 'ready' && (
                    <div className="flex max-w-xs items-center gap-2 pt-0.5">
                        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                            <div
                                className="bg-primary h-full rounded-full transition-[width] duration-500"
                                style={{ width: `${(d.filled.done / Math.max(1, d.filled.total)) * 100}%` }}
                            />
                        </div>
                        <span className="text-muted-foreground text-[11px] tabular-nums">
                            {d.filled.done}/{d.filled.total} fields
                        </span>
                    </div>
                )}

                <p className={cn('text-xs', d.status === 'ready' ? 'text-foreground' : 'text-muted-foreground')}>{d.note}</p>
                {showIssue && <p className={cn('text-xs font-medium', meta.text)}>{d.issue}</p>}
                {d.status === 'ready' && item.kind !== 'response' && (
                    <p className="text-muted-foreground truncate font-mono text-[11px]" title={d.exportName}>
                        → {d.exportName}
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 pl-12 sm:pl-0">
                {na ? (
                    editable && (
                        <Button size="sm" variant="ghost" onClick={() => onSave(null)}>
                            <Undo2 className="size-4" /> Undo
                        </Button>
                    )
                ) : item.kind === 'response' ? (
                    <Button size="sm" variant={d.status === 'ready' ? 'ghost' : 'outline'} asChild>
                        <Link href={route('tenders.bid', tenderId)}>
                            Open bid editor <ArrowRight className="size-4" />
                        </Link>
                    </Button>
                ) : item.kind === 'company' ? (
                    <>
                        {d.vaultDoc && (
                            <Button size="sm" variant="ghost" asChild>
                                <Link href={route('vault.index')}>
                                    <FolderOpen className="size-4" /> Vault
                                </Link>
                            </Button>
                        )}
                        {editable && d.status !== 'ready' && (
                            <Button size="sm" variant="outline" onClick={onVault}>
                                {d.vaultDoc ? <RefreshCw className="size-4" /> : <UploadCloud className="size-4" />}
                                {d.vaultDoc ? 'Renew' : 'Upload to vault'}
                            </Button>
                        )}
                    </>
                ) : item.kind === 'form' ? (
                    <>
                        {editable && item.need === 'conditional' && d.status === 'missing' && (
                            <Button size="sm" variant="ghost" onClick={() => onSave({ notApplicable: true })}>
                                Not needed
                            </Button>
                        )}
                        {editable && (
                            <Button size="sm" variant={d.status === 'ready' ? 'ghost' : 'outline'} onClick={onFill}>
                                <PenLine className="size-4" /> {d.status === 'ready' ? 'View' : d.status === 'missing' ? 'Fill in' : 'Continue'}
                            </Button>
                        )}
                    </>
                ) : (
                    editable && (
                        <>
                            {d.progress.fileName && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8"
                                    onClick={() =>
                                        onSave({ fileName: undefined, sizeBytes: undefined, uploadedAt: undefined, uploadedBy: undefined })
                                    }
                                    aria-label={`Remove ${d.progress.fileName}`}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            )}
                            <Button size="sm" variant={d.status === 'ready' ? 'ghost' : 'outline'} onClick={pickFile}>
                                <UploadCloud className="size-4" /> {d.progress.fileName ? 'Replace' : 'Upload'}
                            </Button>
                            <input
                                ref={input}
                                type="file"
                                className="sr-only"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f)
                                        onSave({ fileName: f.name, sizeBytes: f.size, uploadedAt: new Date().toISOString(), uploadedBy: userName });
                                    e.target.value = '';
                                }}
                            />
                        </>
                    )
                )}
            </div>
        </li>
    );
}

function Ring({ value }: { value: number }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative size-16 shrink-0" role="img" aria-label={`${value}% ready`}>
            <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden>
                <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
                <circle
                    cx="32"
                    cy="32"
                    r={r}
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className={cn('transition-[stroke-dashoffset] duration-700', value === 100 ? 'stroke-status-met' : 'stroke-primary')}
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - value / 100)}
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{value}%</span>
        </div>
    );
}
