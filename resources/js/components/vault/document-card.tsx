import { formatBytes } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import { expiryLabel, expiryMeta, expiryState, usageFor, vaultCategoryMeta } from '@/lib/vault';
import type { VaultDocument } from '@/types/ebis';
import { Link2 } from 'lucide-react';

export function ExpiryPill({ doc, className }: { doc: VaultDocument; className?: string }) {
    const { state, days } = expiryState(doc);
    return (
        <span
            title={expiryLabel(days)}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                expiryMeta[state].pill,
                className,
            )}
        >
            <span className={cn('size-1.5 rounded-full', expiryMeta[state].dot)} />
            {expiryMeta[state].label}
        </span>
    );
}

export function DocIcon({ doc, className }: { doc: Pick<VaultDocument, 'category'>; className?: string }) {
    const Icon = vaultCategoryMeta[doc.category].icon;
    return (
        <span className={cn('bg-primary/8 text-primary dark:bg-primary/15 flex size-10 shrink-0 items-center justify-center rounded-xl', className)}>
            <Icon className="size-5" />
        </span>
    );
}

export function DocumentCard({ doc, onOpen, style }: { doc: VaultDocument; onOpen: () => void; style?: React.CSSProperties }) {
    const { state, days } = expiryState(doc);
    const tenders = new Set(usageFor(doc.factIds).map((u) => u.tender.id)).size;
    const urgent = state === 'expired' || state === 'expiring';

    return (
        <button
            onClick={onOpen}
            style={style}
            className={cn(
                'bg-card animate-fade-up group flex flex-col gap-4 rounded-xl border p-4 text-left transition-all',
                'hover:border-primary/25 focus-visible:ring-ring/40 outline-none hover:shadow-[0_8px_30px_-16px_var(--glow)] focus-visible:ring-2',
                urgent && (state === 'expired' ? 'border-status-not-met/30' : 'border-status-partial/35'),
            )}
        >
            <div className="flex items-start gap-3">
                <DocIcon doc={doc} />
                <div className="min-w-0 flex-1">
                    <p className="leading-snug font-semibold tracking-tight">{doc.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                        {[doc.issuer, doc.reference].filter(Boolean).join(' · ') || vaultCategoryMeta[doc.category].label}
                    </p>
                </div>
            </div>

            <p className="text-muted-foreground line-clamp-2 text-sm">{doc.summary}</p>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <ExpiryPill doc={doc} />
                <span className="text-muted-foreground flex items-center gap-3 text-xs">
                    {tenders > 0 && (
                        <span className="flex items-center gap-1" title="Live tenders relying on this document">
                            <Link2 className="size-3.5" /> {tenders} tender{tenders > 1 ? 's' : ''}
                        </span>
                    )}
                    <span
                        className={cn(
                            urgent && 'font-medium',
                            state === 'expired' && 'text-status-not-met',
                            state === 'expiring' && 'text-status-partial',
                        )}
                    >
                        {doc.expiresAt ? expiryLabel(days) : formatBytes(doc.sizeBytes)}
                    </span>
                </span>
            </div>
        </button>
    );
}
