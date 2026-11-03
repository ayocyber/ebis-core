import { SetupHeader } from '@/components/onboarding/setup-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { classify, type EvidenceSlot, evidenceSlots } from '@/data/evidence-slots';
import { saveDocument } from '@/hooks/use-vault';
import { formatBytes } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import { vaultCategoryMeta, vaultCategoryOrder } from '@/lib/vault';
import { type SharedData } from '@/types';
import type { VaultCategory, VaultDocument } from '@/types/ebis';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, Check, CheckCircle2, CircleSlash, FileUp, Loader2, Plus, ScanText, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';

const MAX = 25 * 1024 * 1024;
const OK_EXT = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];

interface Item {
    id: string;
    slotId?: string;
    fileName: string;
    size: number;
    phase: 'reading' | 'review' | 'added';
    issuer: string;
    reference: string;
    expiresAt: string;
    fact: string;
    /** "Other" documents: the user names it and picks a category */
    customTitle: string;
    customCategory?: VaultCategory;
}

/** Slot id for documents that aren't on the standard list. */
const OTHER = 'other';

const prettyName = (file: string) =>
    file
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/** Ready to save: a known type, or an "other" document with a name and category. */
const canConfirm = (i: Item) =>
    i.phase === 'review' && (i.slotId === OTHER ? !!i.customTitle.trim() && !!i.customCategory : evidenceSlots.some((s) => s.id === i.slotId));

const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function suggestionFor(slot: EvidenceSlot | undefined) {
    const s = slot?.suggest ?? {};
    return { issuer: s.issuer ?? '', reference: s.reference ?? '', expiresAt: s.expiresInDays ? iso(s.expiresInDays) : '', fact: s.fact ?? '' };
}

export default function OnboardingEvidence() {
    const { auth, tenant } = usePage<SharedData>().props;
    const companyName = (tenant as { name?: string } | null)?.name ?? 'your company';
    const [items, setItems] = useState<Item[]>([]);
    const [notHeld, setNotHeld] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const allInput = useRef<HTMLInputElement>(null);

    const update = (id: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

    const addFiles = (files: FileList | File[], forcedSlot?: string) => {
        const rejected: string[] = [];
        const added: Item[] = [];
        for (const f of Array.from(files)) {
            const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
            if (!OK_EXT.includes(ext) || f.size > MAX) {
                rejected.push(f.name);
                continue;
            }
            const slot = forcedSlot ? evidenceSlots.find((s) => s.id === forcedSlot) : classify(f.name);
            added.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                slotId: forcedSlot === OTHER ? OTHER : slot?.id,
                fileName: f.name,
                size: f.size,
                phase: 'reading',
                ...suggestionFor(slot),
                customTitle: forcedSlot === OTHER ? prettyName(f.name) : '',
            });
        }
        setError(rejected.length ? `Skipped ${rejected.join(', ')} — use PDF, Word or images up to 25 MB.` : null);
        if (!added.length) return;
        setItems((list) => [...list, ...added]);
        if (forcedSlot) setNotHeld((n) => n.filter((x) => x !== forcedSlot));
        // Simulated extraction; the real engine reads issuer, numbers and dates.
        added.forEach((it, i) => window.setTimeout(() => update(it.id, { phase: 'review' }), 1100 + i * 350));
    };

    const confirm = (item: Item) => {
        if (!canConfirm(item)) return;
        const slot = evidenceSlots.find((s) => s.id === item.slotId);
        const ext = item.fileName.split('.').pop()!.toLowerCase();
        const doc: VaultDocument = {
            id: `vd-${item.id}`,
            title: slot ? (slot.multiple ? item.fileName.replace(/\.[^.]+$/, '') : slot.title) : item.customTitle.trim(),
            category: slot ? slot.category : item.customCategory!,
            fileName: item.fileName,
            kind: ext === 'docx' ? 'docx' : 'pdf',
            sizeBytes: item.size,
            issuer: item.issuer || undefined,
            reference: item.reference || undefined,
            issuedAt: new Date().toISOString(),
            expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString() : undefined,
            summary: item.fact || (slot ? slot.why : 'Added during setup.'),
            factIds: [],
            uploadedAt: new Date().toISOString(),
            uploadedBy: auth.user.name,
        };
        saveDocument(doc);
        update(item.id, { phase: 'added' });
    };

    const pending = items.filter((i) => i.phase !== 'added');
    const others = items.filter((i) => i.slotId === OTHER && i.phase === 'added');
    const otherInput = useRef<HTMLInputElement>(null);
    const addedFor = (slotId: string) => items.filter((i) => i.slotId === slotId && i.phase === 'added');

    const weight = (s: EvidenceSlot) => (s.tier === 'essential' ? 2 : 1);
    const total = evidenceSlots.reduce((t, s) => t + weight(s), 0);
    const done = evidenceSlots.filter((s) => addedFor(s.id).length > 0);
    const strength = Math.round((done.reduce((t, s) => t + weight(s), 0) / total) * 100);
    const unlocks = done.reduce((t, s) => t + s.unlocks, 0);
    const essentialsLeft = evidenceSlots.filter((s) => s.tier === 'essential' && !addedFor(s.id).length && !notHeld.includes(s.id)).length;

    return (
        <div className="bg-background text-foreground min-h-dvh">
            <Head title="Add your documents" />

            <SetupHeader current={2} />

            <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-8">
                    <div className="animate-fade-up space-y-3">
                        <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">Step 2 of 3</p>
                        <h1 className="text-gradient text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
                            Add the documents tenders always ask for
                        </h1>
                        <p className="text-muted-foreground max-w-2xl text-pretty">
                            Upload them once. EBIS reads each one, checks every tender against them, and warns you before anything expires. You can
                            add more at any time.
                        </p>
                    </div>

                    {/* Drop everything */}
                    <div>
                        <button
                            type="button"
                            onClick={() => allInput.current?.click()}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragging(false);
                                addFiles(e.dataTransfer.files);
                            }}
                            className={cn(
                                'animate-fade-up group relative flex w-full flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all [animation-delay:80ms]',
                                dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'hover:border-primary/40 hover:bg-muted/30',
                            )}
                        >
                            <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl transition-transform group-hover:-translate-y-0.5">
                                <UploadCloud className="size-7" />
                            </span>
                            <span className="text-lg font-semibold">Drop everything at once</span>
                            <span className="text-muted-foreground max-w-md text-sm">
                                Certificates, insurance schedules, accounts, case studies, CVs. EBIS sorts them and reads the key details. PDF, Word
                                or images, up to 25 MB each.
                            </span>
                        </button>
                        <input
                            ref={allInput}
                            type="file"
                            multiple
                            accept=".pdf,.docx,.png,.jpg,.jpeg"
                            className="sr-only"
                            onChange={(e) => {
                                if (e.target.files) addFiles(e.target.files);
                                e.target.value = '';
                            }}
                        />
                        {error && (
                            <p role="alert" className="text-status-not-met mt-2 text-sm">
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Review */}
                    {pending.length > 0 && (
                        <section
                            aria-labelledby="review-title"
                            className="bg-card animate-fade-up rounded-2xl border shadow-[0_20px_60px_-40px_var(--glow)]"
                        >
                            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                                <div>
                                    <h2 id="review-title" className="flex items-center gap-2 font-semibold tracking-tight">
                                        <ScanText className="text-primary size-4" /> Check what EBIS found
                                    </h2>
                                    <p className="text-muted-foreground text-xs">Nothing is saved until you confirm it.</p>
                                </div>
                                {pending.filter(canConfirm).length > 1 && (
                                    <Button size="sm" variant="outline" onClick={() => pending.filter(canConfirm).forEach(confirm)}>
                                        Confirm all
                                    </Button>
                                )}
                            </div>
                            <ul className="divide-y">
                                {pending.map((item) => (
                                    <ReviewRow
                                        key={item.id}
                                        item={item}
                                        onChange={(patch) => update(item.id, patch)}
                                        onConfirm={() => confirm(item)}
                                        onRemove={() => setItems((l) => l.filter((i) => i.id !== item.id))}
                                    />
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Checklist */}
                    {(['essential', 'recommended'] as const).map((tier) => (
                        <section key={tier} className="space-y-3" aria-labelledby={`${tier}-title`}>
                            <div className="flex items-baseline justify-between gap-3">
                                <h2 id={`${tier}-title`} className="font-semibold tracking-tight">
                                    {tier === 'essential' ? 'Essential' : 'Recommended'}
                                </h2>
                                <p className="text-muted-foreground text-xs">
                                    {tier === 'essential' ? 'Most tenders fail you without these' : 'These win you marks'}
                                </p>
                            </div>
                            <ul className="bg-card divide-y overflow-hidden rounded-2xl border">
                                {evidenceSlots
                                    .filter((s) => s.tier === tier)
                                    .map((slot) => (
                                        <SlotRow
                                            key={slot.id}
                                            slot={slot}
                                            added={addedFor(slot.id)}
                                            reading={items.some((i) => i.slotId === slot.id && i.phase !== 'added')}
                                            notHeld={notHeld.includes(slot.id)}
                                            onFiles={(files) => addFiles(files, slot.id)}
                                            onToggleNotHeld={() =>
                                                setNotHeld((n) => (n.includes(slot.id) ? n.filter((x) => x !== slot.id) : [...n, slot.id]))
                                            }
                                        />
                                    ))}
                            </ul>
                        </section>
                    ))}

                    {/* Anything not on the list */}
                    <section className="space-y-3" aria-labelledby="other-title">
                        <div className="flex items-baseline justify-between gap-3">
                            <h2 id="other-title" className="font-semibold tracking-tight">
                                Other documents
                            </h2>
                            <p className="text-muted-foreground text-xs">Anything else tenders in your sector ask for</p>
                        </div>
                        <div className="bg-card overflow-hidden rounded-2xl border">
                            {others.length > 0 && (
                                <ul className="divide-y border-b">
                                    {others.map((o) => {
                                        const Icon = vaultCategoryMeta[o.customCategory ?? 'company'].icon;
                                        return (
                                            <li key={o.id} className="bg-status-met/[0.04] flex items-center gap-3 px-4 py-3 sm:px-5">
                                                <span className="bg-status-met/15 text-status-met flex size-10 shrink-0 items-center justify-center rounded-xl">
                                                    <Icon className="size-5" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium">{o.customTitle}</p>
                                                    <p className="text-muted-foreground truncate text-xs">
                                                        {vaultCategoryMeta[o.customCategory ?? 'company'].label} · {o.fileName}
                                                    </p>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                                <p className="text-muted-foreground flex-1 text-xs leading-relaxed">
                                    Accreditations, awards, trade memberships, test or validation reports, quality manuals, licences. Name it and
                                    choose a category, and EBIS will use it when a tender asks for it.
                                </p>
                                <Button size="sm" variant="outline" onClick={() => otherInput.current?.click()} className="shrink-0">
                                    <Plus className="size-4" /> Add a document
                                </Button>
                                <input
                                    ref={otherInput}
                                    type="file"
                                    multiple
                                    accept=".pdf,.docx,.png,.jpg,.jpeg"
                                    className="sr-only"
                                    onChange={(e) => {
                                        if (e.target.files) addFiles(e.target.files, OTHER);
                                        e.target.value = '';
                                    }}
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Sidebar */}
                <aside className="lg:sticky lg:top-24 lg:self-start">
                    <div className="bg-card space-y-5 rounded-2xl border p-5">
                        <div className="flex items-center gap-4">
                            <StrengthRing value={strength} />
                            <div>
                                <p className="text-muted-foreground text-xs font-medium">Profile strength</p>
                                <p className="font-semibold">{strength >= 80 ? 'Bid-ready' : strength >= 40 ? 'Getting there' : 'Just started'}</p>
                                <p className="text-muted-foreground text-xs">{companyName}</p>
                            </div>
                        </div>

                        <div className="bg-muted/50 rounded-xl p-3">
                            <p className="flex items-center gap-1.5 text-sm font-medium">
                                <Sparkles className="text-primary size-4" /> {unlocks} common requirement{unlocks === 1 ? '' : 's'} covered
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                                Without a document, EBIS marks a requirement “Unknown” rather than guess. Each upload turns more of them into a clear
                                answer.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Button asChild className="h-11 w-full rounded-lg shadow-[0_10px_28px_-12px_var(--glow)]">
                                <Link href={route('tenders.index')}>
                                    Continue to your first tender <ArrowRight className="size-4" />
                                </Link>
                            </Button>
                            <p className="text-muted-foreground text-center text-xs">
                                {essentialsLeft
                                    ? `${essentialsLeft} essential document${essentialsLeft > 1 ? 's' : ''} still to add — you can finish later.`
                                    : 'All essentials covered. Nice.'}
                            </p>
                            <Link
                                href={route('dashboard')}
                                className="text-muted-foreground hover:text-foreground block text-center text-xs underline-offset-4 hover:underline"
                            >
                                Skip for now
                            </Link>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}

function StrengthRing({ value }: { value: number }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative size-16 shrink-0">
            <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden>
                <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
                <circle
                    cx="32"
                    cy="32"
                    r={r}
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className="stroke-primary transition-[stroke-dashoffset] duration-700"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - value / 100)}
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{value}%</span>
        </div>
    );
}

function ReviewRow({
    item,
    onChange,
    onConfirm,
    onRemove,
}: {
    item: Item;
    onChange: (patch: Partial<Item>) => void;
    onConfirm: () => void;
    onRemove: () => void;
}) {
    const slot = evidenceSlots.find((s) => s.id === item.slotId);
    const other = item.slotId === OTHER;
    return (
        <li className="animate-fade-up space-y-3 px-5 py-4">
            <div className="flex items-center gap-3">
                <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                    {item.phase === 'reading' ? <Loader2 className="text-primary size-4 animate-spin" /> : <FileUp className="text-primary size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.fileName}</p>
                    <p className="text-muted-foreground text-xs">
                        {item.phase === 'reading'
                            ? 'Reading…'
                            : slot
                              ? `Looks like: ${slot.title}`
                              : other
                                ? 'Your own document'
                                : 'Not one EBIS recognises. Choose a type, or “Something else”'}{' '}
                        · {formatBytes(item.size)}
                    </p>
                </div>
                <button
                    onClick={onRemove}
                    className="text-muted-foreground hover:text-status-not-met rounded-md p-1.5 transition-colors"
                    aria-label={`Remove ${item.fileName}`}
                >
                    <Trash2 className="size-4" />
                </button>
            </div>

            {item.phase === 'review' && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                        <span className="text-muted-foreground text-xs">Document type</span>
                        <Select
                            value={item.slotId ?? ''}
                            onValueChange={(v) => {
                                const s = evidenceSlots.find((x) => x.id === v);
                                onChange({
                                    slotId: v,
                                    ...suggestionFor(s),
                                    customTitle: v === OTHER && !item.customTitle ? prettyName(item.fileName) : item.customTitle,
                                });
                            }}
                        >
                            <SelectTrigger className={cn('h-9', !item.slotId && 'border-status-partial')} aria-label="Document type">
                                <SelectValue placeholder="Choose a type" />
                            </SelectTrigger>
                            <SelectContent>
                                {evidenceSlots.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.title}
                                    </SelectItem>
                                ))}
                                <SelectSeparator />
                                <SelectItem value={OTHER}>Something else (name it yourself)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {other && (
                        <>
                            <label className="space-y-1">
                                <span className="text-muted-foreground text-xs">Document name</span>
                                <Input
                                    value={item.customTitle}
                                    onChange={(e) => onChange({ customTitle: e.target.value })}
                                    placeholder="e.g. Field trial validation report"
                                    className={cn('h-9', !item.customTitle.trim() && 'border-status-partial')}
                                />
                            </label>
                            <div className="space-y-1">
                                <span className="text-muted-foreground text-xs">Category</span>
                                <Select value={item.customCategory ?? ''} onValueChange={(v) => onChange({ customCategory: v as VaultCategory })}>
                                    <SelectTrigger className={cn('h-9', !item.customCategory && 'border-status-partial')} aria-label="Category">
                                        <SelectValue placeholder="Choose a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vaultCategoryOrder.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {vaultCategoryMeta[c].plural}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                    {(slot || other) && (
                        <>
                            <label className="space-y-1">
                                <span className="text-muted-foreground text-xs">Issued by</span>
                                <Input value={item.issuer} onChange={(e) => onChange({ issuer: e.target.value })} className="h-9" />
                            </label>
                            <label className="space-y-1">
                                <span className="text-muted-foreground text-xs">Expires</span>
                                <Input type="date" value={item.expiresAt} onChange={(e) => onChange({ expiresAt: e.target.value })} className="h-9" />
                            </label>
                            <label className="space-y-1 sm:col-span-2">
                                <span className="text-muted-foreground text-xs">{other ? 'What it shows (optional)' : 'Key detail EBIS found'}</span>
                                <Input value={item.fact} onChange={(e) => onChange({ fact: e.target.value })} className="h-9" />
                            </label>
                        </>
                    )}
                    <div className="flex justify-end sm:col-span-2">
                        <Button size="sm" onClick={onConfirm} disabled={!canConfirm(item)}>
                            <Check className="size-4" /> Confirm
                        </Button>
                    </div>
                </div>
            )}
        </li>
    );
}

function SlotRow({
    slot,
    added,
    reading,
    notHeld,
    onFiles,
    onToggleNotHeld,
}: {
    slot: EvidenceSlot;
    added: Item[];
    reading: boolean;
    notHeld: boolean;
    onFiles: (files: FileList) => void;
    onToggleNotHeld: () => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const Icon = vaultCategoryMeta[slot.category].icon;
    const has = added.length > 0;

    return (
        <li className={cn('flex flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-center sm:px-5', has && 'bg-status-met/[0.04]')}>
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                    className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                        has
                            ? 'bg-status-met/15 text-status-met'
                            : notHeld
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary/8 text-primary dark:bg-primary/15',
                    )}
                >
                    {has ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
                </span>
                <div className="min-w-0">
                    <p className={cn('font-medium', notHeld && 'text-muted-foreground line-through decoration-1')}>{slot.title}</p>
                    {has ? (
                        <p className="text-status-met truncate text-xs font-medium">{added.map((a) => a.fileName).join(', ')}</p>
                    ) : notHeld ? (
                        <p className="text-muted-foreground text-xs">Marked as not held — tenders that need it will show “Not met”.</p>
                    ) : (
                        <p className="text-muted-foreground text-xs leading-relaxed">{slot.why}</p>
                    )}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
                {reading ? (
                    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Loader2 className="size-3.5 animate-spin" /> Reading
                    </span>
                ) : (
                    <>
                        {!has && (
                            <button
                                onClick={onToggleNotHeld}
                                className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
                            >
                                <CircleSlash className="size-3.5" /> {notHeld ? 'Undo' : 'We don’t have this'}
                            </button>
                        )}
                        {(!has || slot.multiple) && !notHeld && (
                            <Button size="sm" variant={has ? 'ghost' : 'outline'} onClick={() => input.current?.click()}>
                                <UploadCloud className="size-4" /> {has ? 'Add another' : 'Upload'}
                            </Button>
                        )}
                    </>
                )}
                <input
                    ref={input}
                    type="file"
                    multiple={slot.multiple}
                    accept=".pdf,.docx,.png,.jpg,.jpeg"
                    className="sr-only"
                    onChange={(e) => {
                        if (e.target.files?.length) onFiles(e.target.files);
                        e.target.value = '';
                    }}
                />
            </div>
        </li>
    );
}
