import { categoryMeta, deadlineLabel, deadlineTone, formatDate, severityMeta, statusMeta } from '@/lib/ebis';
import { AI_REVIEW_THRESHOLD, methodMeta } from '@/lib/rules';
import { cn } from '@/lib/utils';
import type { AssessmentStatus, GapSeverity, RequirementCategory } from '@/types/ebis';
import { Bot, Clock, Hourglass, Scale } from 'lucide-react';
import * as React from 'react';

const pillBase = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset';

export function StatusBadge({
    status,
    size = 'sm',
    className,
    ...props
}: { status: AssessmentStatus; size?: 'sm' | 'md' } & React.HTMLAttributes<HTMLSpanElement>) {
    const meta = statusMeta[status];
    const Icon = meta.icon;
    return (
        <span className={cn(pillBase, meta.pill, size === 'md' && 'px-2.5 py-1 text-sm', className)} {...props}>
            <Icon className={size === 'md' ? 'size-4' : 'size-3.5'} aria-hidden />
            {meta.label}
        </span>
    );
}

export function CategoryBadge({ category, className }: { category: RequirementCategory; className?: string }) {
    const meta = categoryMeta[category];
    return (
        <span className={cn(pillBase, 'rounded-md', meta.className, className)} title={meta.description}>
            {meta.label}
        </span>
    );
}

export function SeverityBadge({ severity, className }: { severity: GapSeverity; className?: string }) {
    const meta = severityMeta[severity];
    const Icon = meta.icon;
    return (
        <span className={cn(pillBase, meta.className, className)}>
            <Icon className="size-3.5" aria-hidden />
            {meta.label}
        </span>
    );
}

/**
 * How a result was reached (ELG-05). Rules are deterministic, so no confidence is shown;
 * AI judgements show their confidence and ask for review below the threshold.
 */
export function MethodBadge({
    method,
    confidence,
    reviewed,
    className,
}: {
    method: 'rule' | 'ai';
    confidence: number;
    reviewed?: boolean;
    className?: string;
}) {
    if (method === 'rule') {
        return (
            <span className={cn(pillBase, 'bg-muted text-muted-foreground ring-border rounded-md', className)} title={methodMeta.rule.hint}>
                <Scale className="size-3" aria-hidden /> Rule
            </span>
        );
    }
    const pct = Math.round(confidence * 100);
    const low = confidence < AI_REVIEW_THRESHOLD && !reviewed;
    return (
        <span
            className={cn(
                pillBase,
                'rounded-md',
                low
                    ? 'bg-status-partial/10 text-status-partial ring-status-partial/25'
                    : 'bg-primary/8 text-primary ring-primary/20 dark:bg-primary/15',
                className,
            )}
            title={`${methodMeta.ai.hint} Confidence ${pct}%.`}
        >
            <Bot className="size-3" aria-hidden /> AI · <span className="tabular-nums">{pct}%</span>
            {low && <span className="font-semibold">· Review</span>}
        </span>
    );
}

/** Evidence that expires before the tender deadline (EVD-02). */
export function StaleBadge({ expiresAt, className }: { expiresAt: string; className?: string }) {
    const past = new Date(expiresAt) < new Date();
    return (
        <span
            className={cn(pillBase, 'bg-status-not-met/10 text-status-not-met ring-status-not-met/25', className)}
            title="Evidence that expires before the tender deadline counts as Partially met"
        >
            <Hourglass className="size-3" aria-hidden />
            Stale · {past ? 'expired' : 'expires'} {formatDate(expiresAt, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
    );
}

/** Thin confidence bar with percentage. */
export function ConfidenceMeter({ value, className, showLabel = true }: { value: number; className?: string; showLabel?: boolean }) {
    const pct = Math.round(value * 100);
    // Neutral brand scale: confidence is about certainty, not good/bad outcome.
    const tone = pct >= 85 ? 'bg-primary' : pct >= 60 ? 'bg-primary/60' : 'bg-primary/30';
    return (
        <div className={cn('flex items-center gap-2', className)} title={`Engine confidence: ${pct}%`}>
            <div
                className="bg-muted h-1.5 w-16 overflow-hidden rounded-full"
                role="meter"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Confidence"
            >
                <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${pct}%` }} />
            </div>
            {showLabel && <span className="text-muted-foreground w-8 text-xs tabular-nums">{pct}%</span>}
        </div>
    );
}

export function DeadlineChip({ days, className }: { days: number; className?: string }) {
    const tone = deadlineTone(days);
    return (
        <span
            className={cn(
                pillBase,
                tone === 'urgent' && 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300',
                tone === 'soon' && 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300',
                tone === 'normal' && 'bg-muted text-muted-foreground ring-border',
                tone === 'past' && 'bg-muted text-muted-foreground ring-border line-through',
                className,
            )}
        >
            <Clock className="size-3.5" aria-hidden />
            {deadlineLabel(days)}
        </span>
    );
}

/** Small keyboard key hint. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <kbd
            className={cn(
                'bg-muted text-muted-foreground border-border inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-sans text-[10px] font-medium',
                className,
            )}
        >
            {children}
        </kbd>
    );
}
