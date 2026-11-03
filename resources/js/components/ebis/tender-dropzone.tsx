import { formatBytes } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import { CheckCircle2, CloudUpload, FileArchive, FileText, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = ['.pdf', '.docx', '.zip'];

interface QueuedFile {
    id: string;
    file: File;
    progress: number;
    error?: string;
}

function validate(file: File): string | undefined {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPT.includes(ext)) return 'Only PDF, DOCX or ZIP files';
    if (file.size > MAX_BYTES) return `Too large (${formatBytes(file.size)}) — max 50 MB`;
    return undefined;
}

/**
 * Stage 1 intake. Validates type/size client-side and shows per-file
 * progress. Upload is simulated until the API endpoint exists.
 */
export function TenderDropzone({ disabled }: { disabled?: boolean }) {
    const [dragging, setDragging] = useState(false);
    const [queue, setQueue] = useState<QueuedFile[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const depth = useRef(0);

    const add = useCallback((files: FileList | null) => {
        if (!files?.length) return;
        const next = Array.from(files).map((file) => ({
            id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
            file,
            progress: 0,
            error: validate(file),
        }));
        setQueue((q) => [...next, ...q]);
    }, []);

    // Simulated upload progress.
    useEffect(() => {
        if (!queue.some((f) => !f.error && f.progress < 100)) return;
        const t = setInterval(() => {
            setQueue((q) =>
                q.map((f) => (f.error || f.progress >= 100 ? f : { ...f, progress: Math.min(100, f.progress + 8 + Math.random() * 14) })),
            );
        }, 180);
        return () => clearInterval(t);
    }, [queue]);

    return (
        <div className="space-y-3">
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
                onClick={() => !disabled && inputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && inputRef.current?.click()}
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
                    'group relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all outline-none',
                    'hover:border-primary/40 hover:bg-accent/40 focus-visible:border-primary focus-visible:ring-primary/15 focus-visible:ring-4',
                    dragging && 'border-primary bg-accent/60 scale-[1.01]',
                    disabled && 'pointer-events-none opacity-60',
                )}
            >
                <span
                    className={cn(
                        'bg-primary/8 text-primary dark:bg-primary/15 flex size-12 items-center justify-center rounded-full transition-transform duration-300',
                        dragging ? '-translate-y-0.5 scale-110' : 'group-hover:-translate-y-0.5',
                    )}
                >
                    <CloudUpload className="size-6" />
                </span>
                <div>
                    <p className="text-sm font-medium">{dragging ? 'Drop to upload' : 'Drag tender documents here, or click to browse'}</p>
                    <p className="text-muted-foreground mt-1 text-xs">PDF, DOCX or ZIP · up to 50 MB each · we’ll extract metadata automatically</p>
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={ACCEPT.join(',')}
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                        add(e.target.files);
                        e.target.value = '';
                    }}
                />
            </div>

            {queue.length > 0 && (
                <ul className="space-y-2">
                    {queue.map((item) => {
                        const isZip = item.file.name.toLowerCase().endsWith('.zip');
                        const Icon = isZip ? FileArchive : FileText;
                        const done = !item.error && item.progress >= 100;
                        return (
                            <li key={item.id} className="bg-card animate-fade-up flex items-center gap-3 rounded-lg border px-3 py-2.5">
                                <Icon className="text-muted-foreground size-5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-sm font-medium">{item.file.name}</p>
                                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{formatBytes(item.file.size)}</span>
                                    </div>
                                    {item.error ? (
                                        <p className="text-status-not-met mt-0.5 flex items-center gap-1 text-xs">
                                            <XCircle className="size-3.5" /> {item.error}
                                        </p>
                                    ) : done ? (
                                        <p className="text-status-met mt-0.5 flex items-center gap-1 text-xs">
                                            <CheckCircle2 className="size-3.5" /> Uploaded — extraction queued
                                        </p>
                                    ) : (
                                        <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
                                            <div
                                                className="bg-primary h-full rounded-full transition-[width] duration-200"
                                                style={{ width: `${item.progress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setQueue((q) => q.filter((f) => f.id !== item.id))}
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1 transition-colors"
                                    aria-label={`Remove ${item.file.name}`}
                                >
                                    <X className="size-4" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
