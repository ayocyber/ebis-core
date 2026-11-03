import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formFields, type ResolvedItem } from '@/lib/checklist';
import { cn } from '@/lib/utils';
import type { ChecklistProgress } from '@/types/ebis';
import { Download, FileCheck2, PenLine, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';

/**
 * Fill in a buyer form (BID-06). EBIS pre-fills what it knows from the profile;
 * the user completes the rest and, where a signature is needed, uploads the signed copy.
 */
export function FormDialog({
    entry,
    userName,
    onOpenChange,
    onSave,
}: {
    entry: ResolvedItem | null;
    userName: string;
    onOpenChange: (open: boolean) => void;
    onSave: (patch: ChecklistProgress) => void;
}) {
    return (
        <Dialog open={!!entry} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
                {entry && <FormBody key={entry.item.id} entry={entry} userName={userName} onSave={onSave} onCancel={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function FormBody({
    entry,
    userName,
    onSave,
    onCancel,
}: {
    entry: ResolvedItem;
    userName: string;
    onSave: (patch: ChecklistProgress) => void;
    onCancel: () => void;
}) {
    const { item, progress } = entry;
    const fields = formFields(item, progress);
    const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.id, f.value])));
    const [fileName, setFileName] = useState(progress.fileName);
    const [sizeBytes, setSizeBytes] = useState(progress.sizeBytes);
    const input = useRef<HTMLInputElement>(null);

    const done = fields.filter((f) => values[f.id]?.trim()).length;
    const complete = done === fields.length;
    const prefilled = fields.filter((f) => f.prefill).length;

    const save = () =>
        onSave({
            fields: values,
            fileName,
            sizeBytes: fileName ? sizeBytes : undefined,
            ...(fileName && fileName !== progress.fileName ? { uploadedAt: new Date().toISOString(), uploadedBy: userName } : {}),
        });

    return (
        <>
            <DialogHeader>
                <DialogTitle>{item.title}</DialogTitle>
                <DialogDescription>
                    {item.source} · {item.why}
                </DialogDescription>
            </DialogHeader>

            {prefilled > 0 && (
                <p className="bg-primary/5 text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
                    <Sparkles className="text-primary size-3.5 shrink-0" />
                    EBIS filled in {prefilled} of {fields.length} fields from your company profile. Check them before you sign.
                </p>
            )}

            <div className="space-y-4">
                {fields.map((f) => {
                    const value = values[f.id] ?? '';
                    const fromEbis = f.prefill && value === f.prefill;
                    return (
                        <label key={f.id} className="block space-y-1.5">
                            <span className="flex items-center justify-between gap-2 text-sm font-medium">
                                {f.label}
                                {fromEbis && f.from && (
                                    <span className="text-primary flex items-center gap-1 text-[11px] font-normal">
                                        <Sparkles className="size-3" /> {f.from}
                                    </span>
                                )}
                            </span>
                            <Input
                                type={f.id === 'date' ? 'date' : 'text'}
                                value={value}
                                onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                                className={cn('h-10', !value.trim() && 'border-status-partial/60')}
                                placeholder={f.id === 'signatory' ? userName : undefined}
                            />
                            {f.hint && <span className="text-muted-foreground block text-xs">{f.hint}</span>}
                        </label>
                    );
                })}
            </div>

            {item.signature && (
                <div className="space-y-3 rounded-xl border p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                        <PenLine className="text-primary size-4" /> Signature
                    </p>
                    <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs">
                        <li>Download the completed form.</li>
                        <li>Sign it (by hand or e-signature) by someone authorised to sign for the company.</li>
                        <li>Upload the signed copy here.</li>
                    </ol>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" disabled title="Arrives with the backend">
                            <Download className="size-4" /> Download completed form
                            <span className="bg-muted rounded px-1.5 text-[10px]">Soon</span>
                        </Button>
                        {fileName ? (
                            <span className="bg-status-met/10 text-status-met flex min-w-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium">
                                <FileCheck2 className="size-3.5 shrink-0" />
                                <span className="truncate">{fileName}</span>
                                <button
                                    type="button"
                                    onClick={() => setFileName(undefined)}
                                    className="hover:text-status-not-met ml-1 shrink-0"
                                    aria-label="Remove signed copy"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </span>
                        ) : (
                            <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={!complete}>
                                <UploadCloud className="size-4" /> Upload signed copy
                            </Button>
                        )}
                        <input
                            ref={input}
                            type="file"
                            accept={item.formats.map((f) => `.${f}`).join(',')}
                            className="sr-only"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                    setFileName(f.name);
                                    setSizeBytes(f.size);
                                }
                                e.target.value = '';
                            }}
                        />
                    </div>
                    {!complete && <p className="text-muted-foreground text-xs">Fill in every field before uploading the signed copy.</p>}
                </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t pt-4">
                <p className="text-muted-foreground text-xs tabular-nums">
                    {done} of {fields.length} fields filled
                </p>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button onClick={save}>Save</Button>
                </div>
            </div>
        </>
    );
}
