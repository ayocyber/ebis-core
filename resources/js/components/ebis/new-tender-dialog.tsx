import { emptyTenderDetails, TenderDetailsFields, type TenderDetails } from '@/components/ebis/tender-details-fields';
import { TenderDropzone } from '@/components/ebis/tender-dropzone';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatBytes } from '@/lib/ebis';
import { type SharedData } from '@/types';
import { Link, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, FileArchive, FileText, Loader2, ScanText, X } from 'lucide-react';
import { useState } from 'react';

type Form = TenderDetails & { files: File[]; allow_duplicate: boolean };

const titleFromFile = (name: string) =>
    name
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/** Stage 1 intake (ING-01…05): files plus the details needed before assessment. */
export function NewTenderDialog({ files, onOpenChange }: { files: File[] | null; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={files !== null} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                {/* Remount per upload so the form starts fresh */}
                {files && <NewTenderForm initialFiles={files} onClose={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function NewTenderForm({ initialFiles, onClose }: { initialFiles: File[]; onClose: () => void }) {
    const { flash } = usePage<SharedData>().props;
    const form = useForm<Form>({
        ...emptyTenderDetails,
        title: initialFiles.length === 1 ? titleFromFile(initialFiles[0].name) : '',
        files: initialFiles,
        allow_duplicate: false,
    });
    const [submitted, setSubmitted] = useState(false);

    const addFiles = (more: File[]) => {
        const seen = new Set(form.data.files.map((f) => `${f.name}:${f.size}`));
        form.setData('files', [...form.data.files, ...more.filter((f) => !seen.has(`${f.name}:${f.size}`))]);
    };

    const submit = (allowDuplicate = false) => {
        setSubmitted(true);
        // Only the "upload anyway" button sends allow_duplicate.
        form.transform((data) => ({ ...data, allow_duplicate: allowDuplicate }));
        form.post(route('tenders.store'), {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onSuccess: (page) => {
                // A duplicate warning keeps the dialog open; anything else lands on the new tender.
                if (!(page.props as unknown as SharedData).flash?.duplicate) onClose();
            },
        });
    };

    const duplicate = submitted && !form.processing ? flash?.duplicate : null;
    const fileErrors = Object.entries(form.errors)
        .filter(([k]) => k === 'files' || k.startsWith('files.'))
        .map(([k, v]) => {
            const i = Number(k.split('.')[1]);
            return Number.isNaN(i) ? v : `${form.data.files[i]?.name ?? 'File'}: ${v}`;
        });
    const uploaded = form.progress?.percentage ?? 0;
    const reading = form.processing && uploaded >= 100;
    const ready = form.data.files.length > 0 && form.data.title.trim() && form.data.buyer_name.trim() && form.data.deadline;

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (ready && !form.processing) submit();
            }}
            className="space-y-5"
        >
            <DialogHeader>
                <DialogTitle>New tender</DialogTitle>
                <DialogDescription>
                    All files become one tender. ProcurPilot reads every page; anything it can’t read (like scanned pages) is listed for you.
                </DialogDescription>
            </DialogHeader>

            <section className="space-y-2" aria-label="Documents">
                <ul className="divide-y rounded-lg border">
                    {form.data.files.map((f, i) => {
                        const Icon = f.name.toLowerCase().endsWith('.zip') ? FileArchive : FileText;
                        return (
                            <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-3 px-3 py-2">
                                <Icon className="text-muted-foreground size-4 shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{formatBytes(f.size)}</span>
                                <button
                                    type="button"
                                    disabled={form.processing}
                                    onClick={() =>
                                        form.setData(
                                            'files',
                                            form.data.files.filter((_, j) => j !== i),
                                        )
                                    }
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1 transition-colors"
                                    aria-label={`Remove ${f.name}`}
                                >
                                    <X className="size-3.5" />
                                </button>
                            </li>
                        );
                    })}
                    {form.data.files.length === 0 && <li className="text-muted-foreground px-3 py-3 text-sm">No documents yet. Add some below.</li>}
                </ul>
                {!form.processing && <TenderDropzone compact onFiles={addFiles} />}
                {fileErrors.map((e) => (
                    <p key={e} className="text-status-not-met text-xs" role="alert">
                        {e}
                    </p>
                ))}
            </section>

            <TenderDetailsFields data={form.data} setData={form.setData} errors={form.errors} idPrefix="new" />

            {duplicate && (
                <div role="alert" className="border-status-partial/40 bg-status-partial/8 space-y-3 rounded-lg border p-3 text-sm">
                    <p className="flex items-start gap-2">
                        <AlertTriangle className="text-status-partial mt-0.5 size-4 shrink-0" />
                        <span>
                            <span className="font-medium">This looks like a tender you already have.</span> {duplicate.message}
                        </span>
                    </p>
                    <div className="flex flex-wrap gap-2 pl-6">
                        <Button size="sm" variant="outline" asChild>
                            <Link href={route('tenders.show', duplicate.tender.id)} onClick={onClose}>
                                Open “{duplicate.tender.title}”
                            </Link>
                        </Button>
                        <Button size="sm" variant="ghost" type="button" onClick={() => submit(true)}>
                            Upload as a new tender anyway
                        </Button>
                    </div>
                </div>
            )}

            {form.processing && (
                <div className="space-y-1.5" aria-live="polite">
                    <p className="text-muted-foreground flex items-center gap-2 text-xs">
                        {reading ? (
                            <>
                                <ScanText className="text-primary size-3.5" /> Reading the documents. Large packs can take a minute…
                            </>
                        ) : (
                            <>Uploading… {uploaded}%</>
                        )}
                    </p>
                    <div className="bg-muted h-1 overflow-hidden rounded-full">
                        <div
                            className={
                                reading ? 'bg-primary h-full w-1/3 animate-pulse rounded-full' : 'bg-primary h-full rounded-full transition-[width]'
                            }
                            style={reading ? undefined : { width: `${uploaded}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose} disabled={form.processing}>
                    Cancel
                </Button>
                <Button type="submit" disabled={!ready || form.processing}>
                    {form.processing && <Loader2 className="size-4 animate-spin" />}
                    {form.processing ? 'Uploading…' : 'Upload tender'}
                </Button>
            </div>
        </form>
    );
}
