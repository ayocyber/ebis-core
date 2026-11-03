import { StatusBadge } from '@/components/ebis/badges';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { DocIcon, ExpiryPill } from '@/components/vault/document-card';
import { profileFacts } from '@/data/mock-ebis';
import { deleteDocument } from '@/hooks/use-vault';
import { formatBytes, formatDate } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import { expiryLabel, expiryState, usageFor, vaultCategoryMeta } from '@/lib/vault';
import type { VaultDocument } from '@/types/ebis';
import { Link } from '@inertiajs/react';
import { ArrowUpRight, Download, FileText, RefreshCw, ScanText, Trash2 } from 'lucide-react';
import { useState } from 'react';

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
    const usage = usageFor(doc.factIds);
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
                    <Button size="icon" variant="ghost" disabled title="Downloads arrive with the backend" aria-label="Download">
                        <Download className="size-4" />
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

                {facts.length > 0 && (
                    <section>
                        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                            <ScanText className="size-3.5" /> What EBIS read from it
                        </h3>
                        <ul className="mt-2 space-y-2">
                            {facts.map((f) => (
                                <li key={f.id} className="rounded-lg border p-3">
                                    <p className="text-muted-foreground text-xs">{f.label}</p>
                                    <p className="text-sm">{f.value}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <section>
                    <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                        <FileText className="size-3.5" /> Used in live tenders
                    </h3>
                    {usage.length ? (
                        <ul className="mt-2 divide-y rounded-xl border">
                            {usage.map((u) => (
                                <li key={u.tender.id + u.code}>
                                    <Link
                                        href={route('tenders.eligibility', u.tender.id)}
                                        className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2.5 transition-colors"
                                    >
                                        <span className="text-muted-foreground w-9 font-mono text-xs">{u.code}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm">{u.title}</span>
                                            <span className="text-muted-foreground block font-mono text-[11px]">{u.tender.reference}</span>
                                        </span>
                                        <StatusBadge status={u.status} className="text-[10px]" />
                                        <ArrowUpRight className="text-muted-foreground size-3.5" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground mt-2 text-sm">No live tender relies on this document yet.</p>
                    )}
                </section>
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
                                    deleteDocument(doc.id);
                                    onDeleted();
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
