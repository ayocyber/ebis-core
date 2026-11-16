import { StatusBadge } from '@/components/ebis/badges';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { setGapStatusFor } from '@/hooks/use-tender-workspace';
import { firstError, saveDocument } from '@/hooks/use-vault';
import { formatBytes, formatDate } from '@/lib/ebis';
import { type DocumentReading, foundFields, readDocument, slotFor } from '@/lib/read-document';
import { cn } from '@/lib/utils';
import { type DocUsage, vaultCategoryMeta, vaultCategoryOrder } from '@/lib/vault';
import type { MissingEvidence, Tender, VaultCategory, VaultDocument } from '@/types/ebis';
import { Link } from '@inertiajs/react';
import { CheckCircle2, FileUp, Loader2, PartyPopper, UploadCloud } from 'lucide-react';
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

type Step = 'pick' | 'details' | 'done';

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
        // Dates come from the document itself; nothing is guessed (a wrong expiry would skew every eligibility check).
        issuedAt: '',
        expiresAt: '',
    });
    const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

    const accept = (f: File) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        if (!['pdf', 'docx', 'png', 'jpg', 'jpeg'].includes(ext)) return setError('Use a PDF, Word document or image.');
        if (f.size > MAX) return setError(`That file is ${formatBytes(f.size)}. The limit is 25 MB.`);
        setError(null);
        setFile(f);
        setReading(undefined);
        setStep('details');
        // Fill in what the document's text says; the title stays as given when the upload is for a known slot.
        const fixedTitle = !!form.title;
        void readDocument(f).then((r) => {
            setReading(r);
            const slot = slotFor(r?.kind);
            setForm((cur) => ({
                ...cur,
                title: fixedTitle ? cur.title : cur.title || slot?.title || f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
                category: fixedTitle || !slot ? cur.category : slot.category,
                issuer: cur.issuer || r?.issuer || '',
                reference: cur.reference || r?.reference || '',
                expiresAt: cur.expiresAt || r?.expires_at || '',
            }));
        });
    };
    const [reading, setReading] = useState<DocumentReading | null | undefined>(undefined);

    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!file) return;
        const g = target.gap;
        let viaVault: DocUsage[] = [];
        // Bid-only documents stay with the tender (sample data until M6); company documents go to the vault.
        if (g?.scope !== 'bid') {
            setSaving(true);
            setError(null);
            try {
                viaVault = await saveDocument({
                    file,
                    title: form.title.trim(),
                    category: form.category,
                    issuer: form.issuer.trim(),
                    reference: form.reference.trim(),
                    issuedAt: form.issuedAt,
                    expiresAt: form.expiresAt,
                    summary: base?.summary ?? target.missing?.why,
                    factIds: base ? undefined : target.missing?.factId ? [target.missing.factId] : undefined,
                    replaces: base?.id,
                });
            } catch (errors) {
                setError(firstError(errors));
                return;
            } finally {
                setSaving(false);
            }
        }
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
                        : 'ProcurPilot will use it the next time a tender asks for it.'}
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
                            : 'Add the details from the document, especially the expiry date.'}
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

            {step === 'details' && file && (
                <form
                    className="animate-fade-up space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (valid && !saving) void save();
                    }}
                >
                    <div className="bg-muted/50 flex items-center gap-3 rounded-lg border p-3">
                        <FileUp className="text-primary size-5 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{file.name}</p>
                            <p className="text-muted-foreground text-xs">
                                {formatBytes(file.size)} ·{' '}
                                {reading === undefined
                                    ? 'reading the document…'
                                    : !reading
                                      ? 'couldn’t be read just now; add its details below'
                                      : !reading.readable
                                        ? 'no text to read (a scan or image); add its details below'
                                        : foundFields(reading).filter((x) => x !== 'cover').length
                                          ? `filled in from the document: ${foundFields(reading)
                                                .filter((x) => x !== 'cover')
                                                .join(', ')}. Check them.`
                                          : 'read, but no dates or numbers found; add its details below'}
                            </p>
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
                                {expiryInPast
                                    ? 'This date has passed — upload the current version.'
                                    : base?.expiresAt && !form.expiresAt
                                      ? `The current one expires ${formatDate(base.expiresAt)}. Enter the new date from the document.`
                                      : 'Leave empty if it never expires.'}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <p role="alert" className="text-status-not-met text-sm">
                            {error}
                        </p>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!valid || saving}>
                            {saving && <Loader2 className="size-4 animate-spin" />}
                            {target.gap?.scope === 'bid' ? 'Add to this bid' : saving ? 'Saving…' : 'Save to vault'}
                        </Button>
                    </div>
                </form>
            )}
        </>
    );
}
