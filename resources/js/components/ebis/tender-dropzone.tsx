import { formatBytes } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import { CloudUpload, XCircle } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

export const TENDER_MAX_BYTES = 50 * 1024 * 1024;
export const TENDER_ACCEPT = ['.pdf', '.docx', '.zip'];

/** ING-01: the same rules the server applies, checked before uploading. */
export function tenderFileError(file: File): string | undefined {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!TENDER_ACCEPT.includes(ext)) return 'Only PDF, Word (DOCX) or ZIP files';
    if (file.size > TENDER_MAX_BYTES) return `Too large (${formatBytes(file.size)}). The limit is 50 MB`;
    return undefined;
}

/**
 * Stage 1 intake: pick or drop tender files. Valid files go to `onFiles`;
 * rejected ones are listed with the reason.
 */
export function TenderDropzone({
    disabled,
    onFiles,
    compact = false,
    hint = 'PDF, Word (DOCX) or ZIP · up to 50 MB each',
}: {
    disabled?: boolean;
    onFiles: (files: File[]) => void;
    compact?: boolean;
    hint?: string;
}) {
    const [dragging, setDragging] = useState(false);
    const [rejected, setRejected] = useState<{ name: string; error: string }[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const depth = useRef(0);

    const add = useCallback(
        (list: FileList | null) => {
            if (!list?.length) return;
            const files = Array.from(list);
            const bad = files.flatMap((f) => {
                const error = tenderFileError(f);
                return error ? [{ name: f.name, error }] : [];
            });
            setRejected(bad);
            const good = files.filter((f) => !tenderFileError(f));
            if (good.length) onFiles(good);
        },
        [onFiles],
    );

    const open = () => !disabled && inputRef.current?.click();

    return (
        <div className="space-y-2">
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
                onClick={open}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        open();
                    }
                }}
                onDragEnter={(e) => {
                    e.preventDefault();
                    if (disabled) return;
                    depth.current++;
                    setDragging(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => {
                    depth.current = Math.max(0, depth.current - 1);
                    if (depth.current === 0) setDragging(false);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    depth.current = 0;
                    setDragging(false);
                    if (!disabled) add(e.dataTransfer.files);
                }}
                className={cn(
                    'group relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed text-center transition-all outline-none',
                    compact ? 'px-4 py-5' : 'px-6 py-8',
                    'hover:border-primary/40 hover:bg-accent/40 focus-visible:border-primary focus-visible:ring-primary/15 focus-visible:ring-4',
                    dragging && 'border-primary bg-accent/60 scale-[1.01]',
                    disabled && 'pointer-events-none opacity-60',
                )}
            >
                <span
                    className={cn(
                        'bg-primary/8 text-primary dark:bg-primary/15 flex items-center justify-center rounded-full transition-transform duration-300',
                        compact ? 'size-9' : 'size-12',
                        dragging ? '-translate-y-0.5 scale-110' : 'group-hover:-translate-y-0.5',
                    )}
                >
                    <CloudUpload className={compact ? 'size-5' : 'size-6'} />
                </span>
                <div>
                    <p className="text-sm font-medium">
                        {dragging ? 'Drop to add' : compact ? 'Add more documents' : 'Drag tender documents here, or click to browse'}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">{disabled ? 'Only owners and editors can upload' : hint}</p>
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={TENDER_ACCEPT.join(',')}
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                        add(e.target.files);
                        e.target.value = '';
                    }}
                />
            </div>

            {rejected.length > 0 && (
                <ul className="space-y-1" role="alert">
                    {rejected.map((r) => (
                        <li key={r.name} className="text-status-not-met flex items-center gap-1.5 text-xs">
                            <XCircle className="size-3.5 shrink-0" />
                            <span className="truncate font-medium">{r.name}</span>
                            <span className="shrink-0">· {r.error}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
