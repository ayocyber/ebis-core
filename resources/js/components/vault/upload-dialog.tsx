import { StatusBadge } from '@/components/ebis/badges';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { setGapStatusFor } from '@/hooks/use-tender-workspace';
import { saveDocument } from '@/hooks/use-vault';
import { formatBytes } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import { type DocUsage, vaultCategoryMeta, vaultCategoryOrder } from '@/lib/vault';
import { type SharedData } from '@/types';
import type { MissingEvidence, Tender, TenderDocumentKind, VaultCategory, VaultDocument } from '@/types/ebis';
import { Link, usePage } from '@inertiajs/react';
import { CheckCircle2, FileUp, Loader2, PartyPopper, ScanText, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';

const MAX = 25 * 1024 * 1024;
const ACCEPT = '.pdf,.docx,.png,.jpg,.jpeg';

export interface UploadTarget {
    replace?: VaultDocument;
    missing?: MissingEvidence;
    /** Upload started from a tender gap. Closes that gap on save. */
    gap?: {
        tender: Tender;
        gapId: string;
        code: string;
        requirementTitle: string;
        scope: 'company' | 'bid';
        title: string;
        category: VaultCategory;
    };
}

type Step = 'pick' | 'reading' | 'details' | 'done';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function UploadDialog({ open, onOpenChange, target }: { open: boolean; onOpenChange: (o: boolean) => void; target: UploadTarget }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
                {/* Remount on every open so the form starts fresh */}
                {open && (
                    <UploadFlow
                        key={target.gap?.gapId ?? target.replace?.id ?? target.missing?.id ?? 'new'}
                        target={target}
                        onClose={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function UploadFlow({ target, onClose }: { target: UploadTarget; onClose: () => void }) {
    const { auth } = usePage<SharedData>().props;
    const inputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<Step>('pick');
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [fixed, setFixed] = useState<DocUsage[]>([]);

    const base = target.replace;
    const [form, setForm] = useState({
        title: target.gap?.title ?? base?.title ?? target.missing?.title ?? '',
        category: (base?.category ?? target.gap?.category ?? target.missing?.category ?? 'certificate') as VaultCategory,
        issuer: base?.issuer ?? '',
        reference: '',
        issuedAt: iso(new Date()),
        expiresAt: base?.expiresAt ? iso(new Date(Date.now() + 365 * 86_400_000)) : '',
    });
    const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

    const accept = (f: File) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        if (!['pdf', 'docx', 'png', 'jpg', 'jpeg'].includes(ext)) return setError('Use a PDF, Word document or image.');
        if (f.size > MAX) return setError(`That file is ${formatBytes(f.size)}. The limit is 25 MB.`);
        setError(null);
        setFile(f);
        if (!form.title) set({ title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') });
        // Simulated read: the real engine extracts issuer, reference and dates.
        setStep('reading');
        window.setTimeout(() => setStep('details'), 1400);
    };

    const save = () => {
        if (!file) return;
        const ext = file.name.split('.').pop()!.toLowerCase();
        const doc: VaultDocument = {
            id: `vd-${Date.now()}`,
            title: form.title.trim(),
            category: form.category,
            fileName: file.name,
            kind: (ext === 'docx' ? 'docx' : 'pdf') as TenderDocumentKind,
            sizeBytes: file.size,
            issuer: form.issuer.trim() || undefined,
            reference: form.reference.trim() || undefined,
            issuedAt: form.issuedAt ? new Date(form.issuedAt).toISOString() : undefined,
            expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
            summary: base?.summary ?? target.missing?.why ?? 'Uploaded to the vault.',
            factIds: base?.factIds ?? (target.missing?.factId ? [target.missing.factId] : []),
            uploadedAt: new Date().toISOString(),
            uploadedBy: auth.user.name,
            replaces: base?.id,
        };
        const g = target.gap;
        // Bid-only documents stay with the tender; company documents go to the vault for reuse.
        const viaVault = g?.scope === 'bid' ? [] : saveDocument(doc, target.missing?.id);
        if (g) {
            setGapStatusFor(g.tender.id, g.gapId, 'closed', g.scope === 'bid' ? `${form.title.trim()} added to this bid` : undefined);
            if (!viaVault.some((u) => u.tender.id === g.tender.id && u.code === g.code))
                viaVault.unshift({ tender: g.tender, code: g.code, title: g.requirementTitle, status: 'met', gapId: g.gapId });
        }
        setFixed(viaVault);
        setStep('done');
    };

    const expiryInPast = form.expiresAt && new Date(form.expiresAt) < new Date();
    const valid = form.title.trim().length > 1 && !expiryInPast;

    if (step === 'done') {
        return (
            <div className="animate-fade-up py-2 text-center">
                <span className="bg-status-met/15 text-status-met mx-auto flex size-14 items-center justify-center rounded-2xl">
                    {fixed.length ? <PartyPopper className="size-7" /> : <CheckCircle2 className="size-7" />}
                </span>
                <DialogTitle className="mt-4 text-xl">
                    {fixed.length ? (target.gap?.scope === 'bid' ? 'Added to this bid' : 'Saved — and it fixes live bids') : 'Saved to the vault'}
                </DialogTitle>
                <DialogDescription className="mt-1">
                    {fixed.length
                        ? `${fixed.length} requirement${fixed.length > 1 ? 's' : ''} now ${fixed.length > 1 ? 'have' : 'has'} the evidence ${fixed.length > 1 ? 'they need' : 'it needs'}. The matching gaps are closed.`
                        : 'EBIS will use it the next time a tender asks for it.'}
                </DialogDescription>
                {fixed.length > 0 && (
                    <ul className="mt-5 divide-y rounded-xl border text-left">
                        {fixed.map((u) => (
                            <li key={u.tender.id + u.code} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                                <span className="text-muted-foreground font-mono text-xs">{u.code}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate">{u.title}</span>
                                    <span className="text-muted-foreground block font-mono text-[11px]">{u.tender.reference}</span>
                                </span>
                                <StatusBadge status="met" className="text-[10px]" />
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
                    <Button variant="outline" onClick={onClose}>
                        Done
                    </Button>
                    {fixed.length > 0 && (
                        <Button asChild>
                            <Link href={route('tenders.gaps', fixed[0].tender.id)} onClick={onClose}>
                                See the gap plan
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle>
                    {target.gap
                        ? `Upload ${target.gap.title}`
                        : base
                          ? `Replace ${base.title}`
                          : target.missing
                            ? `Add ${target.missing.title}`
                            : 'Upload to the vault'}
                </DialogTitle>
                <DialogDescription>
                    {target.gap?.scope === 'bid'
                        ? `Kept with ${target.gap.tender.reference} only. It won’t be added to your vault.`
                        : target.gap
                          ? `Closes ${target.gap.code} and is saved to your vault, so future tenders find it too.`
                          : base
                            ? 'The old version is archived. Tenders using it switch to the new one.'
                            : 'EBIS reads the document and fills in the details for you.'}
                </DialogDescription>
            </DialogHeader>

            {step === 'pick' && (
                <div>
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragging(false);
                            const f = e.dataTransfer.files[0];
                            if (f) accept(f);
                        }}
                        className={cn(
                            'flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                            dragging ? 'border-primary bg-primary/5' : 'hover:border-primary/40 hover:bg-muted/40',
                        )}
                    >
                        <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
                            <UploadCloud className="size-6" />
                        </span>
                        <span className="font-medium">Drop a file or click to browse</span>
                        <span className="text-muted-foreground text-xs">PDF, Word or image · up to 25 MB</span>
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPT}
                        className="sr-only"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) accept(f);
                            e.target.value = '';
                        }}
                    />
                    {error && (
                        <p role="alert" className="text-status-not-met mt-2 text-sm">
                            {error}
                        </p>
                    )}
                </div>
            )}

            {step === 'reading' && (
                <div className="flex flex-col items-center gap-3 py-10 text-center" aria-live="polite">
                    <span className="relative flex size-12 items-center justify-center">
                        <ScanText className="text-primary size-6" />
                        <Loader2 className="text-primary/40 absolute size-12 animate-spin" strokeWidth={1} />
                    </span>
                    <p className="font-medium">Reading {file?.name}…</p>
                    <p className="text-muted-foreground text-xs">Looking for the issuer, reference number and dates</p>
                </div>
            )}

            {step === 'details' && file && (
                <form
                    className="animate-fade-up space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (valid) save();
                    }}
                >
                    <div className="bg-muted/50 flex items-center gap-3 rounded-lg border p-3">
                        <FileUp className="text-primary size-5 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{file.name}</p>
                            <p className="text-muted-foreground text-xs">{formatBytes(file.size)} · details read by EBIS, check them below</p>
                        </div>
                        <button type="button" onClick={() => setStep('pick')} className="text-primary text-xs font-medium hover:underline">
                            Change
                        </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="vd-title">Title</Label>
                            <Input id="vd-title" value={form.title} onChange={(e) => set({ title: e.target.value })} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="vd-cat">Type</Label>
                            <Select value={form.category} onValueChange={(v) => set({ category: v as VaultCategory })}>
                                <SelectTrigger id="vd-cat">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {vaultCategoryOrder.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {vaultCategoryMeta[c].label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="vd-issuer">Issued by</Label>
                            <Input
                                id="vd-issuer"
                                value={form.issuer}
                                onChange={(e) => set({ issuer: e.target.value })}
                                placeholder="e.g. IASME Consortium"
                            />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="vd-ref">Reference / certificate number</Label>
                            <Input id="vd-ref" value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Optional" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="vd-issued">Issued</Label>
                            <Input id="vd-issued" type="date" value={form.issuedAt} onChange={(e) => set({ issuedAt: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="vd-expires">Expires</Label>
                            <Input id="vd-expires" type="date" value={form.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} />
                            <p className={cn('text-xs', expiryInPast ? 'text-status-not-met' : 'text-muted-foreground')}>
                                {expiryInPast ? 'This date has passed — upload the current version.' : 'Leave empty if it never expires.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!valid}>
                            {target.gap?.scope === 'bid' ? 'Add to this bid' : 'Save to vault'}
                        </Button>
                    </div>
                </form>
            )}
        </>
    );
}
