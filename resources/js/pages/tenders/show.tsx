import { buyerTypes, detailsFromTender, TenderDetailsFields, type TenderDetails } from '@/components/ebis/tender-details-fields';
import { TenderDropzone } from '@/components/ebis/tender-dropzone';
import { TenderHeader } from '@/components/ebis/tender-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { formatBytes, formatDate } from '@/lib/ebis';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { Tender, TenderDocument } from '@/types/ebis';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Download,
    FileArchive,
    FileText,
    ListChecks,
    Loader2,
    Pencil,
    RotateCw,
    ScanText,
    Sparkles,
    Trash2,
    XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function TenderShow({ tender, requirementCounts }: { tender: Tender; requirementCounts: { confirmed: number; suggested: number } }) {
    const { role } = usePage<SharedData>().props;
    const editable = canEdit(role);
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [removing, setRemoving] = useState<TenderDocument | null>(null);
    const [adding, setAdding] = useState(false);

    const docs = tender.documents;
    const pending = docs.filter((d) => d.extraction?.status === 'pending').length;
    const failed = docs.filter((d) => d.extraction?.status === 'failed').length;
    const partial = docs.filter((d) => d.extraction?.status === 'partial').length;
    const read = docs.length - pending - failed;
    const pages = docs.reduce((n, d) => n + (d.pages ?? 0), 0);

    // Reading normally finishes during the upload; if a worker is doing it, check back.
    useEffect(() => {
        if (!pending) return;
        const t = setInterval(() => router.reload({ only: ['tender'] }), 4000);
        return () => clearInterval(t);
    }, [pending]);

    const addDocuments = (files: File[]) => {
        router.post(
            route('tenders.documents.store', tender.id),
            { files },
            { forceFormData: true, preserveScroll: true, onStart: () => setAdding(true), onFinish: () => setAdding(false) },
        );
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference || tender.title, href: route('tenders.show', tender.id) },
            ]}
        >
            <Head title={tender.reference || tender.title} />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <TenderHeader
                    tender={tender}
                    actions={
                        editable && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                                    <Pencil className="size-4" /> Edit details
                                </Button>
                                <Button variant="ghost" size="sm" className="text-status-not-met" onClick={() => setDeleting(true)}>
                                    <Trash2 className="size-4" /> Delete
                                </Button>
                            </>
                        )
                    }
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-6">
                        {/* Reading status */}
                        <section className="bg-card animate-fade-up rounded-2xl border p-5 [animation-delay:60ms] sm:p-6" aria-live="polite">
                            <div className="flex items-start gap-4">
                                <span
                                    className={cn(
                                        'flex size-11 shrink-0 items-center justify-center rounded-xl',
                                        pending
                                            ? 'bg-primary/10 text-primary'
                                            : failed
                                              ? 'bg-status-not-met/10 text-status-not-met'
                                              : partial
                                                ? 'bg-status-partial/10 text-status-partial'
                                                : 'bg-status-met/10 text-status-met',
                                    )}
                                >
                                    {pending ? <Loader2 className="size-5 animate-spin" /> : <ScanText className="size-5" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h2 className="font-semibold tracking-tight">
                                        {pending
                                            ? `Reading ${pending} document${pending > 1 ? 's' : ''}…`
                                            : `${read} of ${docs.length} document${docs.length > 1 ? 's' : ''} read`}
                                    </h2>
                                    <p className="text-muted-foreground mt-0.5 text-sm">
                                        {pages > 0 && `${pages} page${pages > 1 ? 's' : ''} in total. `}
                                        {failed > 0 && `${failed} couldn’t be read. `}
                                        {partial > 0 && `${partial} ha${partial > 1 ? 've' : 's'} pages without readable text, usually scans. `}
                                        {!pending && !failed && !partial && 'Every page was read.'}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Documents */}
                        <section className="animate-fade-up space-y-3 [animation-delay:100ms]">
                            <h2 className="text-base font-semibold">
                                Documents <span className="text-muted-foreground font-normal tabular-nums">({docs.length})</span>
                            </h2>
                            <ul className="bg-card divide-y overflow-hidden rounded-xl border shadow-xs">
                                {docs.map((d) => (
                                    <DocumentRow
                                        key={d.id}
                                        tender={tender}
                                        doc={d}
                                        editable={editable}
                                        onRemove={docs.length > 1 ? () => setRemoving(d) : undefined}
                                    />
                                ))}
                            </ul>
                            {editable &&
                                (adding ? (
                                    <p className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed px-4 py-5 text-sm">
                                        <Loader2 className="text-primary size-4 animate-spin" /> Uploading and reading the new documents…
                                    </p>
                                ) : (
                                    <TenderDropzone
                                        compact
                                        onFiles={addDocuments}
                                        hint="Clarifications, addenda or anything missing · PDF, DOCX or ZIP"
                                    />
                                ))}
                        </section>
                    </div>

                    <aside className="space-y-6">
                        <NextStep tender={tender} counts={requirementCounts} />
                        <DetailsCard tender={tender} />
                    </aside>
                </div>
            </div>

            {editable && (
                <>
                    <EditDetailsDialog tender={tender} open={editing} onOpenChange={setEditing} />
                    <ConfirmDialog
                        open={deleting}
                        onOpenChange={setDeleting}
                        title="Delete this tender?"
                        description={`“${tender.title}” and its ${docs.length} document${docs.length > 1 ? 's' : ''} will be removed from your tenders. The deletion is recorded in the activity log.`}
                        confirm="Delete tender"
                        onConfirm={() => router.delete(route('tenders.destroy', tender.id))}
                    />
                    <ConfirmDialog
                        open={removing !== null}
                        onOpenChange={(o) => !o && setRemoving(null)}
                        title="Remove this document?"
                        description={removing ? `${removing.name} will be removed from this tender.` : ''}
                        confirm="Remove document"
                        onConfirm={() =>
                            removing &&
                            router.delete(route('tenders.documents.destroy', [tender.id, removing.id]), {
                                preserveScroll: true,
                                onFinish: () => setRemoving(null),
                            })
                        }
                    />
                </>
            )}
        </AppLayout>
    );
}

function DocumentRow({ tender, doc, editable, onRemove }: { tender: Tender; doc: TenderDocument; editable: boolean; onRemove?: () => void }) {
    const [retrying, setRetrying] = useState(false);
    const status = doc.extraction?.status ?? 'done';
    const Icon = doc.kind === 'zip' ? FileArchive : FileText;
    const unreadable = doc.extraction?.unreadablePages ?? [];

    return (
        <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={doc.name}>
                        {doc.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        {[doc.role, doc.pages ? `${doc.pages} page${doc.pages > 1 ? 's' : ''}` : null, formatBytes(doc.sizeBytes)]
                            .filter(Boolean)
                            .join(' · ')}
                        {doc.fromArchive && <span className="block truncate sm:inline"> · from {doc.fromArchive}</span>}
                    </p>
                    <p
                        className={cn(
                            'mt-1 flex items-start gap-1 text-xs',
                            status === 'done' && 'text-status-met',
                            status === 'partial' && 'text-status-partial',
                            status === 'failed' && 'text-status-not-met',
                            status === 'pending' && 'text-muted-foreground',
                        )}
                    >
                        {status === 'done' && (
                            <>
                                <CheckCircle2 className="mt-px size-3.5 shrink-0" /> Read
                            </>
                        )}
                        {status === 'pending' && (
                            <>
                                <Loader2 className="mt-px size-3.5 shrink-0 animate-spin" /> Reading…
                            </>
                        )}
                        {status === 'partial' && (
                            <>
                                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                                Read, except {unreadable.length === 1 ? 'page' : 'pages'} {pageList(unreadable)}: no readable text (probably scanned)
                            </>
                        )}
                        {status === 'failed' && (
                            <>
                                <XCircle className="mt-px size-3.5 shrink-0" /> {doc.extraction?.error ?? 'Couldn’t be read.'}
                            </>
                        )}
                    </p>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 pl-8 sm:pl-0">
                {editable && status === 'failed' && (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={retrying}
                        onClick={() =>
                            router.post(
                                route('tenders.documents.retry', [tender.id, doc.id]),
                                {},
                                { preserveScroll: true, onStart: () => setRetrying(true), onFinish: () => setRetrying(false) },
                            )
                        }
                    >
                        <RotateCw className={cn('size-3.5', retrying && 'animate-spin')} /> Try again
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="size-8" asChild>
                    <a href={route('tenders.documents.download', [tender.id, doc.id])} aria-label={`Download ${doc.name}`} title="Download">
                        <Download className="size-4" />
                    </a>
                </Button>
                {editable && onRemove && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground size-8"
                        onClick={onRemove}
                        aria-label={`Remove ${doc.name}`}
                        title="Remove"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                )}
            </div>
        </li>
    );
}

/** "2, 5 and 9"; long lists are shortened to the first six. */
function pageList(pages: number[]): string {
    if (pages.length > 8) return `${pages.slice(0, 6).join(', ')} and ${pages.length - 6} more`;
    if (pages.length === 1) return String(pages[0]);
    return `${pages.slice(0, -1).join(', ')} and ${pages[pages.length - 1]}`;
}

function NextStep({ tender, counts }: { tender: Tender; counts: { confirmed: number; suggested: number } }) {
    const { confirmed, suggested } = counts;
    return (
        <section className="from-primary/8 animate-fade-up rounded-2xl border bg-gradient-to-br to-transparent p-5 [animation-delay:120ms]">
            <p className="flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="text-primary size-4" /> Next: requirements
            </p>
            <p className="text-muted-foreground mt-1.5 text-sm">
                {suggested > 0
                    ? `ProcurPilot found ${suggested} possible requirement${suggested > 1 ? 's' : ''} in these documents. Check them and add anything it missed.`
                    : confirmed > 0
                      ? `${confirmed} requirement${confirmed > 1 ? 's' : ''} confirmed.`
                      : 'List what the buyer asks for. Each one is then checked against your company profile and vault.'}
            </p>
            <Button size="sm" className="mt-3" asChild>
                <Link href={route('tenders.requirements', tender.id)}>
                    {suggested > 0 ? 'Review requirements' : 'Open requirements'} <ArrowRight className="size-3.5" />
                </Link>
            </Button>
            <Link
                href={route('tenders.eligibility', 'tnd-001')}
                className="text-muted-foreground hover:text-foreground mt-3 flex items-center gap-1 text-xs font-medium"
            >
                <Sparkles className="size-3.5" /> See the later stages on a sample tender
            </Link>
        </section>
    );
}

function DetailsCard({ tender }: { tender: Tender }) {
    const rows: [string, React.ReactNode][] = [
        ['Buyer type', buyerTypes.find((b) => b.value === tender.buyer.type)?.label],
        ['Location', tender.buyer.location],
        ['Sector', tender.sector],
        ['Lots', tender.lots],
        [
            'Clarifications by',
            tender.clarificationDeadline &&
                formatDate(tender.clarificationDeadline, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        ],
        ['Added by', `${tender.owner.name}, ${formatDate(tender.createdAt)}`],
    ];

    return (
        <section className="bg-card animate-fade-up rounded-2xl border p-5 [animation-delay:160ms]">
            <h2 className="text-sm font-semibold">Details</h2>
            {tender.summary && <p className="text-muted-foreground mt-2 text-sm">{tender.summary}</p>}
            <dl className="mt-3 space-y-2 text-sm">
                {rows
                    .filter(([, v]) => v !== undefined && v !== null && v !== '')
                    .map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">{k}</dt>
                            <dd className="text-right">{v}</dd>
                        </div>
                    ))}
            </dl>
        </section>
    );
}

function EditDetailsDialog({ tender, open, onOpenChange }: { tender: Tender; open: boolean; onOpenChange: (o: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                {open && <EditDetailsForm tender={tender} onClose={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function EditDetailsForm({ tender, onClose }: { tender: Tender; onClose: () => void }) {
    const form = useForm<TenderDetails>(detailsFromTender(tender));

    return (
        <form
            className="space-y-5"
            onSubmit={(e) => {
                e.preventDefault();
                form.patch(route('tenders.update', tender.id), { preserveScroll: true, onSuccess: onClose });
            }}
        >
            <DialogHeader>
                <DialogTitle>Edit tender details</DialogTitle>
                <DialogDescription>Changes are recorded in the activity log.</DialogDescription>
            </DialogHeader>
            <TenderDetailsFields data={form.data} setData={form.setData} errors={form.errors} idPrefix="edit" startExpanded />
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onClose} disabled={form.processing}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing}>
                    {form.processing && <Loader2 className="size-4 animate-spin" />} Save details
                </Button>
            </DialogFooter>
        </form>
    );
}

function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirm,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    title: string;
    description: string;
    confirm: string;
    onConfirm: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={onConfirm}>
                        {confirm}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
