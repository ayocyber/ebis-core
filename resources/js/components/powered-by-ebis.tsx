import { cn } from '@/lib/utils';

/** "Powered by EBIS" badge using the official EBIS logo. */
export function PoweredByEbis({ className, compact = false }: { className?: string; compact?: boolean }) {
    return (
        <a
            href="https://www.ebis.ng/"
            target="_blank"
            rel="noopener noreferrer"
            title="Enterprise Business Information Systems"
            className={cn(
                'group text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] transition-colors',
                className,
            )}
        >
            <span className="shrink-0 rounded-md bg-white px-1.5 py-1 shadow-xs ring-1 ring-black/5 transition-transform group-hover:scale-[1.03]">
                <img src="/images/ebis-logo.png" alt="EBIS" className="h-5 w-auto" />
            </span>
            {!compact && (
                <span className="leading-tight">
                    Powered by
                    <span className="text-foreground block font-medium">EBIS Tech Group</span>
                </span>
            )}
        </a>
    );
}
