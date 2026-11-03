import { cn } from '@/lib/utils';
import * as React from 'react';

/** Card with a soft spotlight that follows the cursor. */
export function SpotlightCard({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    const ref = React.useRef<HTMLDivElement>(null);

    return (
        <div
            ref={ref}
            onMouseMove={(e) => {
                const el = ref.current;
                if (!el) return;
                const r = el.getBoundingClientRect();
                el.style.setProperty('--x', `${e.clientX - r.left}px`);
                el.style.setProperty('--y', `${e.clientY - r.top}px`);
            }}
            className={cn(
                'group/spot bg-card relative overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-300',
                'dark:bg-card/70 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
                'hover:border-primary/25',
                className,
            )}
            {...props}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
                style={{
                    background:
                        'radial-gradient(420px circle at var(--x, 50%) var(--y, 50%), color-mix(in oklab, var(--glow) 10%, transparent), transparent 70%)',
                }}
            />
            <div className="relative h-full">{children}</div>
        </div>
    );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <p className={cn('text-primary inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase', className)}>
            <span className="from-primary to-brand-accent h-px w-6 bg-gradient-to-r" />
            {children}
        </p>
    );
}

export function SectionHeading({
    eyebrow,
    title,
    text,
    align = 'center',
}: {
    eyebrow: string;
    title: React.ReactNode;
    text?: string;
    align?: 'center' | 'left';
}) {
    return (
        <div className={cn('reveal max-w-2xl space-y-4', align === 'center' && 'mx-auto text-center')}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="text-gradient text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.08]">
                {title}
            </h2>
            {text && <p className="text-muted-foreground text-base text-pretty sm:text-lg">{text}</p>}
        </div>
    );
}

/** Ambient glow + fading grid used behind hero and CTA. */
export function Backdrop({ className }: { className?: string }) {
    return (
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
            <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent_75%)]" />
            <div className="bg-glow/30 animate-glow dark:bg-glow/35 absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full blur-[120px]" />
            <div className="bg-brand-accent/20 dark:bg-brand-accent/15 absolute top-24 left-[62%] h-[260px] w-[360px] rounded-full blur-[110px]" />
        </div>
    );
}
