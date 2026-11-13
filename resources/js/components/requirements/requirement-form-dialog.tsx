import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { categoryMeta, topicLabels } from '@/lib/ebis';
import { checkTypes, insuranceKinds } from '@/lib/requirements';
import { vaultCategoryMeta, vaultCategoryOrder } from '@/lib/vault';
import type { Requirement, RequirementCategory, RequirementTopic, Tender } from '@/types/ebis';
import { useForm } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';

type CheckType = (typeof checkTypes)[number]['value'];

type Form = {
    title: string;
    text: string;
    category: RequirementCategory;
    topic: RequirementTopic;
    weight: string;
    document_id: string;
    page: string;
    section: string;
    quote: string;
    check: { type: CheckType; amount: string; years: string; kind: string; name: string; category: string; count: string };
};

const NONE = '__none';
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

function initial(r?: Requirement): Form {
    const c = (r?.check ?? {}) as Record<string, unknown>;
    return {
        title: r?.title ?? '',
        text: r?.text ?? '',
        category: r?.category ?? 'mandatory',
        topic: r?.topic ?? 'technical',
        weight: str(r?.weight),
        document_id: r?.source.documentId ?? '',
        page: r?.source.page ? String(r.source.page) : '',
        section: r?.source.section ?? '',
        quote: r?.source.quote ?? '',
        check: {
            type: (r?.check?.type ?? 'judgement') as CheckType,
            amount: str(c.amount),
            years: str(c.years),
            kind: str(c.kind) || 'public',
            name: str(c.name),
            category: str(c.category) || 'experience',
            count: str(c.count) || '1',
        },
    };
}

/** Add a requirement, or edit one (confirmed or still a suggestion). TUN-03. */
export function RequirementFormDialog({
    tender,
    editing,
    open,
    onOpenChange,
}: {
    tender: Tender;
    editing?: Requirement;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                {open && <RequirementForm tender={tender} editing={editing} onClose={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function RequirementForm({ tender, editing, onClose }: { tender: Tender; editing?: Requirement; onClose: () => void }) {
    const form = useForm<Form>(initial(editing));
    const { data, setData, errors } = form;
    const err = (k: string) => (errors as Record<string, string | undefined>)[k];
    const setCheck = (patch: Partial<Form['check']>) => setData('check', { ...data.check, ...patch });
    const hint = checkTypes.find((c) => c.value === data.check.type)?.hint;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (editing) form.patch(route('tenders.requirements.update', [tender.id, editing.id]), options);
        else form.post(route('tenders.requirements.store', tender.id), options);
    };

    const fieldError = (k: string) =>
        err(k) ? (
            <p className="text-status-not-met text-xs" role="alert">
                {err(k)}
            </p>
        ) : null;

    return (
        <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
                <DialogTitle>{editing ? (editing.confirmed ? `Edit ${editing.code}` : 'Edit suggestion') : 'Add a requirement'}</DialogTitle>
                <DialogDescription>
                    {editing?.confirmed ? 'Changes are versioned and recorded in the activity log.' : 'Copy it from the tender, and say where it is.'}
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="rq-title">Short title</Label>
                    <Input
                        id="rq-title"
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                        placeholder="e.g. Cyber Essentials Plus"
                        required
                    />
                    {fieldError('title')}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="rq-text">What the buyer asks for</Label>
                    <textarea
                        id="rq-text"
                        value={data.text}
                        onChange={(e) => setData('text', e.target.value)}
                        rows={3}
                        required
                        className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                    />
                    {fieldError('text')}
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="rq-cat">Type</Label>
                    <Select value={data.category} onValueChange={(v) => setData('category', v as RequirementCategory)}>
                        <SelectTrigger id="rq-cat">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(Object.keys(categoryMeta) as RequirementCategory[]).map((c) => (
                                <SelectItem key={c} value={c}>
                                    {categoryMeta[c].label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">{categoryMeta[data.category].description}</p>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="rq-topic">Topic</Label>
                    <Select value={data.topic} onValueChange={(v) => setData('topic', v as RequirementTopic)}>
                        <SelectTrigger id="rq-topic">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(Object.keys(topicLabels) as RequirementTopic[]).map((t) => (
                                <SelectItem key={t} value={t}>
                                    {topicLabels[t]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {data.category === 'scored' && (
                    <div className="space-y-1.5">
                        <Label htmlFor="rq-weight">Weight (%)</Label>
                        <Input
                            id="rq-weight"
                            type="number"
                            min={0}
                            max={100}
                            value={data.weight}
                            onChange={(e) => setData('weight', e.target.value)}
                        />
                        {fieldError('weight')}
                    </div>
                )}
            </div>

            {/* How it is checked */}
            <fieldset className="bg-muted/40 space-y-3 rounded-xl border p-4">
                <legend className="px-1 text-sm font-medium">How ProcurPilot checks it</legend>
                <Select value={data.check.type} onValueChange={(v) => setCheck({ type: v as CheckType })}>
                    <SelectTrigger aria-label="How it is checked">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {checkTypes.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                                {c.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {hint && <p className="text-muted-foreground text-xs">{hint}</p>}

                <div className="grid gap-3 sm:grid-cols-2">
                    {data.check.type === 'insurance_min' && (
                        <div className="space-y-1.5">
                            <Label htmlFor="rq-kind">Insurance</Label>
                            <Select value={data.check.kind} onValueChange={(v) => setCheck({ kind: v })}>
                                <SelectTrigger id="rq-kind">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {insuranceKinds.map((k) => (
                                        <SelectItem key={k.value} value={k.value}>
                                            {k.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {(data.check.type === 'turnover_min' || data.check.type === 'insurance_min') && (
                        <div className="space-y-1.5">
                            <Label htmlFor="rq-amount">At least (£)</Label>
                            <Input
                                id="rq-amount"
                                type="number"
                                min={1}
                                step={1000}
                                value={data.check.amount}
                                onChange={(e) => setCheck({ amount: e.target.value })}
                            />
                            {fieldError('check.amount')}
                        </div>
                    )}
                    {(data.check.type === 'turnover_min' || data.check.type === 'years_trading') && (
                        <div className="space-y-1.5">
                            <Label htmlFor="rq-years">{data.check.type === 'turnover_min' ? 'In each of the last … years' : 'Years trading'}</Label>
                            <Input
                                id="rq-years"
                                type="number"
                                min={1}
                                max={50}
                                value={data.check.years}
                                onChange={(e) => setCheck({ years: e.target.value })}
                                placeholder={data.check.type === 'turnover_min' ? '1' : ''}
                            />
                            {fieldError('check.years')}
                        </div>
                    )}
                    {data.check.type === 'certification' && (
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="rq-name">Certificate</Label>
                            <Input
                                id="rq-name"
                                value={data.check.name}
                                onChange={(e) => setCheck({ name: e.target.value })}
                                placeholder="e.g. Cyber Essentials Plus, ISO 9001"
                            />
                            {fieldError('check.name')}
                        </div>
                    )}
                    {data.check.type === 'vault_documents' && (
                        <>
                            <div className="space-y-1.5">
                                <Label htmlFor="rq-vcat">Kind of document</Label>
                                <Select value={data.check.category} onValueChange={(v) => setCheck({ category: v })}>
                                    <SelectTrigger id="rq-vcat">
                                        <SelectValue />
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
                            <div className="space-y-1.5">
                                <Label htmlFor="rq-count">How many</Label>
                                <Input
                                    id="rq-count"
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={data.check.count}
                                    onChange={(e) => setCheck({ count: e.target.value })}
                                />
                            </div>
                        </>
                    )}
                </div>
            </fieldset>

            {/* Where it is (EVD-01) */}
            <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Where it is in the tender</legend>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px_110px]">
                    <Select value={data.document_id || NONE} onValueChange={(v) => setData('document_id', v === NONE ? '' : v)}>
                        <SelectTrigger aria-label="Document">
                            <SelectValue placeholder="Document" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>Not linked to a document</SelectItem>
                            {tender.documents.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                    {d.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="number"
                        min={1}
                        value={data.page}
                        onChange={(e) => setData('page', e.target.value)}
                        placeholder="Page"
                        aria-label="Page"
                    />
                    <Input
                        value={data.section}
                        onChange={(e) => setData('section', e.target.value)}
                        placeholder="Clause"
                        aria-label="Clause or section"
                    />
                </div>
                {fieldError('document_id')}
                <textarea
                    value={data.quote}
                    onChange={(e) => setData('quote', e.target.value)}
                    rows={2}
                    placeholder="The exact words from the tender (optional)"
                    aria-label="Exact words from the tender"
                    className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                />
            </fieldset>

            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onClose} disabled={form.processing}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing || !data.title.trim() || !data.text.trim()}>
                    {form.processing && <Loader2 className="size-4 animate-spin" />}
                    {editing ? 'Save' : 'Add requirement'}
                </Button>
            </DialogFooter>
        </form>
    );
}
