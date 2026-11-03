import { cn } from '@/lib/utils';
import { Transition } from '@headlessui/react';
import { CheckCircle2 } from 'lucide-react';

/** A titled settings panel with an optional footer for the save button. */
export function SettingsCard({
    title,
    description,
    children,
    footer,
    tone = 'default',
    className,
}: {
    title: string;
    description?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    tone?: 'default' | 'danger';
    className?: string;
}) {
    return (
        <section
            className={cn('bg-card overflow-hidden rounded-2xl border', tone === 'danger' && 'border-status-not-met/30', className)}
            aria-label={title}
        >
            <header className={cn('border-b px-5 py-4 sm:px-6', tone === 'danger' && 'border-status-not-met/20 bg-status-not-met/[0.04]')}>
                <h2 className={cn('font-semibold tracking-tight', tone === 'danger' && 'text-status-not-met')}>{title}</h2>
                {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
            </header>
            <div className="p-5 sm:p-6">{children}</div>
            {footer && <footer className="bg-muted/30 flex flex-wrap items-center justify-end gap-3 border-t px-5 py-3 sm:px-6">{footer}</footer>}
        </section>
    );
}

/** "Saved" confirmation that fades in after a successful save. */
export function SavedNote({ show }: { show: boolean }) {
    return (
        <Transition show={show} enter="transition ease-in-out" enterFrom="opacity-0" leave="transition ease-in-out" leaveTo="opacity-0">
            <p className="text-status-met flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="size-4" /> Saved
            </p>
        </Transition>
    );
}

export function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}
