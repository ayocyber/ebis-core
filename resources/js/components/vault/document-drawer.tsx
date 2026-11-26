import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { DocIcon, ExpiryPill } from '@/components/vault/document-card';
import { profileFacts } from '@/data/mock-ebis';
import { deleteDocument } from '@/hooks/use-vault';
import { formatBytes, formatDate } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import { expiryLabel, expiryState, vaultCategoryMeta } from '@/lib/vault';
import type { VaultDocument } from '@/types/ebis';
import { router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Download, RefreshCw, ScanText, ShieldAlert, ShieldCheck, ShieldQuestion, Trash2 } from 'lucide-react';
import { useState } from 'react';

// Labels only: the values in that file belong to the demo company.
const factsById = Object.fromEntries(Object.values(profileFacts).map((f) => [f.id, f]));

export function DocumentDrawer({
    doc,
    open,
    onOpenChange,
    canEdit,
    onReplace,
}: {
    doc: VaultDocument | null;
    open: boolean;
    onOpenChange: (o: boolean) => void;
    canEdit: boolean;
    onReplace: (doc: VaultDocument) => void;
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg [&>button:last-child]:top-4 [&>button:last-child]:right-4"
            >
                {doc && <Body key={doc.id} doc={doc} canEdit={canEdit} onReplace={() => onReplace(doc)} onDeleted={() => onOpenChange(false)} />}
            </SheetContent>
        </Sheet>
    );
}

function Body({ doc, canEdit, onReplace, onDeleted }: { doc: VaultDocument; canEdit: boolean; onReplace: () => void; onDeleted: () => void }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const facts = doc.factIds.map((id) => factsById[id]).filter(Boolean);
    const { state, days } = expiryState(doc);

    return (
        <>
            <div className="border-b px-5 pt-5 pr-12 pb-4">
                <div className="flex items-start gap-3">
                    <DocIcon doc={doc} />
                    <div className="min-w-0">
                        <p className="text-muted-foreground text-xs">{vaultCategoryMeta[doc.category].label}</p>
                        <SheetTitle className="text-lg leading-snug">{doc.title}</SheetTitle>
                        <SheetDescription className="sr-only">Document details</SheetDescription>
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ExpiryPill doc={doc} />
                    <span
                        className={cn(
                            'text-xs',
                            state === 'expired'
                                ? 'text-status-not-met font-medium'
                                : state === 'expiring'
                                  ? 'text-status-partial font-medium'
                                  : 'text-muted-foreground',
                        )}
                    >
                        {expiryLabel(days)}
                    </span>
                </div>
            </div>

            <div className="flex-1 space-y-6 p-5">
                {/* File */}
                <div className="bg-muted/40 flex items-center gap-4 rounded-xl border p-3">
                    <div className="bg-card relative flex h-16 w-12 shrink-0 flex-col gap-1 rounded-md border p-1.5 shadow-sm" aria-hidden>
                        <span className="bg-muted h-1 w-full rounded" />
                        <span className="bg-muted h-1 w-4/5 rounded" />
                        <span className="bg-muted h-1 w-full rounded" />
                        <span className="bg-muted h-1 w-3/5 rounded" />
                        <span className="bg-primary/70 absolute bottom-1.5 left-1.5 rounded px-1 text-[7px] font-bold text-white uppercase">
                            {doc.kind}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{doc.fileName}</p>
                        <p className="text-muted-foreground text-xs">
                            {formatBytes(doc.sizeBytes)} · uploaded {formatDate(doc.uploadedAt)} by {doc.uploadedBy}
                        </p>
                    </div>
                    <Button size="icon" variant="ghost" asChild title="Download" aria-label={`Download ${doc.fileName}`}>
                        {/* A plain link: the browser handles the file download, not Inertia. */}
                        <a href={route('vault.download', doc.id)} download>
                            <Download className="size-4" />
                        </a>
                    </Button>
                </div>

                <p className="text-sm leading-relaxed">{doc.summary}</p>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    {[
                        ['Issued by', doc.issuer],
                        ['Reference', doc.reference],
                        ['Issued', doc.issuedAt && formatDate(doc.issuedAt)],
                        ['Expires', doc.expiresAt ? formatDate(doc.expiresAt) : 'Never'],
                    ].map(([k, v]) => (
                        <div key={k}>
                            <dt className="text-muted-foreground text-xs">{k}</dt>
                            <dd className="font-medium">{v || '—'}</dd>
                        </div>
                    ))}
                </dl>

                <ContentCheck doc={doc} canEdit={canEdit} />

                {facts.length > 0 && (
                    <section>
                        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                            <ScanText className="size-3.5" /> What it proves
                        </h3>
                        <ul className="mt-2 space-y-2">
                            {facts.map((f) => (
                                <li key={f.id} className="rounded-lg border p-3 text-sm">
                                    {f.label}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            {canEdit && (
                <div className="bg-background/95 sticky bottom-0 flex items-center justify-between gap-2 border-t px-5 py-3 backdrop-blur">
                    {confirmDelete ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Delete this file?</span>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                    deleteDocument(doc.id, onDeleted);
                                }}
                            >
                                Delete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                                Keep
                            </Button>
                        </div>
                    ) : (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-status-not-met"
                            onClick={() => setConfirmDelete(true)}
                        >
                            <Trash2 className="size-4" /> Delete
                        </Button>
                    )}
                    {!confirmDelete && (
                        <Button size="sm" onClick={onReplace}>
                            <RefreshCw className="size-4" /> {state === 'expired' || state === 'expiring' ? 'Upload renewal' : 'Replace'}
                        </Button>
                    )}
                </div>
            )}
        </>
    );
}

/** What reading the document found, compared with what was entered. */
function ContentCheck({ doc, canEdit }: { doc: VaultDocument; canEdit: boolean }) {
    const [checking, setChecking] = useState(false);
    const check = doc.check;
    const meta = {
        passed: { label: 'Matches what you entered', className: 'text-status-met', icon: ShieldCheck },
        warnings: { label: 'Something to look at', className: 'text-status-partial', icon: ShieldAlert },
        unreadable: { label: 'Couldn’t be checked', className: 'text-muted-foreground', icon: ShieldQuestion },
    } as const;
    const m = check ? meta[check.status] : null;

    return (
        <section>
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                    <ScanText className="size-3.5" /> Content check
                </h3>
                {canEdit && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={checking}
                        onClick={() =>
                            router.post(
                                route('vault.check', doc.id),
                                {},
                                { preserveScroll: true, onStart: () => setChecking(true), onFinish: () => setChecking(false) },
                            )
                        }
                    >
                        <RefreshCw className={cn('size-3.5', checking && 'animate-spin')} /> {check ? 'Check again' : 'Check now'}
                    </Button>
                )}
            </div>
            {!check || !m ? (
                <p className="text-muted-foreground mt-2 text-sm">
                    Not checked yet: it was uploaded before ProcurPilot read documents. Check it now to compare it with what was entered.
                </p>
            ) : (
                <div className="mt-2 rounded-lg border p-3">
                    <p className={cn('flex items-center gap-1.5 text-sm font-medium', m.className)}>
                        <m.icon className="size-4" /> {m.label}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                        {check.notes.map((n, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs">
                                {n.level === 'ok' ? (
                                    <CheckCircle2 className="text-status-met mt-px size-3.5 shrink-0" />
                                ) : (
                                    <AlertTriangle className="text-status-partial mt-px size-3.5 shrink-0" />
                                )}
                                <span>{n.text}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-muted-foreground mt-2 text-[11px]">
                        Reads the text only, without AI. It flags what to look at; it can’t prove a document is genuine.
                    </p>
                </div>
            )}
        </section>
    );
}
