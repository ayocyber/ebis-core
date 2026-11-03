import { CategoryBadge, Kbd, MethodBadge, SeverityBadge, StaleBadge, StatusBadge } from '@/components/ebis/badges';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { daysUntil, factSourceLabels, formatDate, statusMeta, statusOrder, topicLabels } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import type { AssessmentStatus, EligibilityRow, ProfileFact } from '@/types/ebis';
import {
    BadgeCheck,
    CalendarClock,
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    FileText,
    History,
    Lightbulb,
    PencilLine,
    Quote,
    Sparkles,
    UserRound,
    Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
    row: EligibilityRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    position: { index: number; total: number };
    onPrev: () => void;
    onNext: () => void;
    canEdit: boolean;
    onOverride: (requirementId: string, status: AssessmentStatus, reason: string) => void;
    onToggleReviewed: (requirementId: string) => void;
}

export function EvidenceDrawer({ row, open, onOpenChange, position, onPrev, onNext, canEdit, onOverride, onToggleReviewed }: Props) {
    // ↑/↓ or K/J step through requirements while the drawer is open.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
            if (e.key === 'ArrowDown' || e.key === 'j') {
                e.preventDefault();
                onNext();
            } else if (e.key === 'ArrowUp' || e.key === 'k') {
                e.preventDefault();
                onPrev();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onNext, onPrev]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="flex w-full flex-col gap-0 p-0 sm:max-w-xl [&>button:last-child]:top-4 [&>button:last-child]:right-4"
            >
                {row ? (
                    <DrawerBody
                        key={row.requirement.id}
                        row={row}
                        position={position}
                        onPrev={onPrev}
                        onNext={onNext}
                        canEdit={canEdit}
                        onOverride={onOverride}
                        onToggleReviewed={onToggleReviewed}
                    />
                ) : (
                    <SheetTitle className="sr-only">Evidence</SheetTitle>
                )}
            </SheetContent>
        </Sheet>
    );
}

function DrawerBody({
    row,
    position,
    onPrev,
    onNext,
    canEdit,
    onOverride,
    onToggleReviewed,
}: Omit<Props, 'open' | 'onOpenChange' | 'row'> & { row: EligibilityRow }) {
    const { requirement: r, assessment: a, gap } = row;
    const ev = a.evidence;

    return (
        <TooltipProvider delayDuration={300}>
            {/* Header */}
            <header className="border-b px-5 pt-4 pb-4 sm:px-6">
                <div className="flex items-center gap-2 pr-8">
                    <span className="text-muted-foreground font-mono text-xs font-medium">{r.code}</span>
                    <CategoryBadge category={r.category} />
                    <span className="text-muted-foreground truncate text-xs">{topicLabels[r.topic]}</span>
                    {r.weight ? <span className="text-muted-foreground text-xs tabular-nums">· {r.weight} pts</span> : null}
                </div>
                <SheetTitle className="mt-2 text-lg leading-snug font-semibold tracking-tight">{r.title}</SheetTitle>
                <SheetDescription className="mt-1 text-sm">{r.text}</SheetDescription>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <StatusBadge status={a.status} size="md" />
                    <MethodBadge method={a.method} confidence={a.confidence} reviewed={a.reviewed} />
                    {a.stale && <StaleBadge expiresAt={a.stale.expiresAt} />}
                    {a.reviewed && (
                        <span className="text-status-met flex items-center gap-1 text-xs font-medium">
                            <BadgeCheck className="size-3.5" /> Reviewed
                        </span>
                    )}
                </div>
            </header>

            {/* Scrollable body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
                <div className={cn('animate-fade-up flex gap-3 rounded-lg border p-3', statusTint[a.status])}>
                    <Sparkles className={cn('mt-0.5 size-4 shrink-0', statusMeta[a.status].text)} />
                    <div className="text-sm">
                        <p className="font-medium">{a.summary}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                            Assessed by {a.assessedBy === 'ebis-engine' ? 'EBIS engine' : a.assessedBy} ·{' '}
                            {formatDate(a.assessedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>

                {a.override && (
                    <div className="animate-fade-up flex gap-3 rounded-lg border border-dashed p-3 text-sm">
                        <History className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        <div>
                            <p>
                                <span className="font-medium">{a.override.by}</span> changed status from{' '}
                                <span className="font-medium">{statusMeta[a.override.previousStatus].label}</span>
                            </p>
                            <p className="text-muted-foreground mt-0.5">“{a.override.reason}”</p>
                        </div>
                    </div>
                )}

                <Section icon={Quote} title="Tender clause" style={{ animationDelay: '40ms' }}>
                    <figure className="bg-muted/40 rounded-lg border">
                        <blockquote className="border-primary/40 m-3 border-l-2 pl-3 text-sm leading-relaxed">
                            <HighlightedQuote text={ev.clauseQuote} highlight={ev.highlight} />
                        </blockquote>
                        <figcaption className="flex items-center gap-2 border-t px-3 py-2">
                            <FileText className="text-muted-foreground size-4 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium" title={ev.source.documentName}>
                                    {ev.source.documentName}
                                </p>
                                <p className="text-muted-foreground text-[11px]">
                                    Page {ev.source.page}
                                    {ev.source.section ? ` · ${ev.source.section}` : ''}
                                </p>
                            </div>
                            <CopyCitation
                                text={`${ev.source.documentName}, p. ${ev.source.page}${ev.source.section ? `, ${ev.source.section}` : ''}: “${ev.clauseQuote}”`}
                            />
                        </figcaption>
                    </figure>
                </Section>

                <Section icon={UserRound} title={`Profile facts used (${ev.profileFacts.length})`} style={{ animationDelay: '80ms' }}>
                    <ul className="space-y-2">
                        {ev.profileFacts.map((fact) => (
                            <FactCard key={fact.id} fact={fact} />
                        ))}
                    </ul>
                </Section>

                <Section icon={Lightbulb} title="How this status was reached" style={{ animationDelay: '120ms' }}>
                    <p className="text-muted-foreground text-sm leading-relaxed">{ev.reasoning}</p>
                </Section>

                {gap && (
                    <Section icon={Wrench} title="Gap & remedy" style={{ animationDelay: '160ms' }}>
                        <div className="overflow-hidden rounded-lg border">
                            <div className="flex items-start justify-between gap-3 p-3">
                                <div>
                                    <p className="text-sm font-medium">{gap.title}</p>
                                    <p className="text-muted-foreground mt-0.5 text-xs">{gap.description}</p>
                                </div>
                                <SeverityBadge severity={gap.severity} />
                            </div>
                            <div className="bg-muted/40 border-t p-3 text-sm leading-relaxed">{gap.remedy}</div>
                            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-xs">
                                <span className="flex items-center gap-1">
                                    <CalendarClock className="size-3.5" />~{gap.timeToCloseDays} working day{gap.timeToCloseDays === 1 ? '' : 's'} to
                                    close
                                </span>
                                {gap.owner && <span>Owner: {gap.owner}</span>}
                                <span className="ml-auto capitalize">{gap.status.replace('_', ' ')}</span>
                            </div>
                        </div>
                    </Section>
                )}

                {canEdit && <OverridePanel current={a.status} onSave={(status, reason) => onOverride(r.id, status, reason)} />}
            </div>

            {/* Footer */}
            <footer className="bg-background/95 flex items-center gap-2 border-t px-5 py-3 backdrop-blur sm:px-6">
                <div className="flex items-center">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={onPrev}
                                disabled={position.index === 0}
                                aria-label="Previous requirement"
                            >
                                <ChevronUp className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            Previous <Kbd className="ml-1">↑</Kbd>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={onNext}
                                disabled={position.index >= position.total - 1}
                                aria-label="Next requirement"
                            >
                                <ChevronDown className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            Next <Kbd className="ml-1">↓</Kbd>
                        </TooltipContent>
                    </Tooltip>
                    <span className="text-muted-foreground ml-1 text-xs tabular-nums">
                        {position.index + 1} of {position.total}
                    </span>
                </div>
                {canEdit && (
                    <Button size="sm" variant={a.reviewed ? 'outline' : 'default'} className="ml-auto" onClick={() => onToggleReviewed(r.id)}>
                        {a.reviewed ? (
                            <>
                                <Check className="size-4" /> Reviewed
                            </>
                        ) : (
                            <>
                                <BadgeCheck className="size-4" /> Mark as reviewed
                            </>
                        )}
                    </Button>
                )}
            </footer>
        </TooltipProvider>
    );
}

const statusTint: Record<AssessmentStatus, string> = {
    met: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5',
    partially_met: 'border-amber-200 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5',
    not_met: 'border-red-200 bg-red-50/60 dark:border-red-500/20 dark:bg-red-500/5',
    unknown: 'bg-muted/40',
};

function Section({
    icon: Icon,
    title,
    children,
    style,
}: {
    icon: typeof Quote;
    title: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    return (
        <section className="animate-fade-up" style={style}>
            <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <Icon className="size-3.5" />
                {title}
            </h3>
            {children}
        </section>
    );
}

function HighlightedQuote({ text, highlight }: { text: string; highlight?: string }) {
    if (!highlight) return <>{text}</>;
    const i = text.indexOf(highlight);
    if (i === -1) return <>{text}</>;
    return (
        <>
            {text.slice(0, i)}
            <mark className="bg-brand-accent/15 text-foreground rounded-sm decoration-clone px-0.5 font-medium">{highlight}</mark>
            {text.slice(i + highlight.length)}
        </>
    );
}

function CopyCitation({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(text);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        } catch {
                            /* clipboard unavailable — ignore */
                        }
                    }}
                    aria-label="Copy citation"
                >
                    {copied ? <Check className="text-status-met size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? 'Copied' : 'Copy citation'}</TooltipContent>
        </Tooltip>
    );
}

function FactCard({ fact }: { fact: ProfileFact }) {
    const expiresIn = fact.expiresAt ? daysUntil(fact.expiresAt) : null;
    const missing = fact.value === 'Not on file';

    return (
        <li className={cn('bg-card rounded-lg border p-3 transition-colors', missing && 'border-dashed')}>
            <div className="flex items-start justify-between gap-3">
                <p className="text-muted-foreground text-xs font-medium">{fact.label}</p>
                <span className="text-muted-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                    {factSourceLabels[fact.source]}
                </span>
            </div>
            <p className={cn('mt-1 text-sm', missing && 'text-muted-foreground italic')}>{fact.value}</p>
            {(fact.documentName || fact.verifiedAt || expiresIn !== null) && (
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    {fact.documentName && (
                        <span className="flex min-w-0 items-center gap-1">
                            <FileText className="size-3 shrink-0" />
                            <span className="truncate">{fact.documentName}</span>
                        </span>
                    )}
                    {fact.verifiedAt && <span>Verified {formatDate(fact.verifiedAt)}</span>}
                    {expiresIn !== null && (
                        <span
                            className={cn(
                                'font-medium',
                                expiresIn < 0 && 'text-status-not-met',
                                expiresIn >= 0 && expiresIn <= 60 && 'text-status-partial',
                            )}
                        >
                            {expiresIn < 0 ? `Expired ${formatDate(fact.expiresAt!)}` : `Expires ${formatDate(fact.expiresAt!)}`}
                        </span>
                    )}
                </div>
            )}
        </li>
    );
}

function OverridePanel({ current, onSave }: { current: AssessmentStatus; onSave: (s: AssessmentStatus, reason: string) => void }) {
    const [editing, setEditing] = useState(false);
    const [status, setStatus] = useState<AssessmentStatus>(current);
    const [reason, setReason] = useState('');
    const valid = status !== current && reason.trim().length >= 10;

    if (!editing) {
        return (
            <button
                onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-foreground hover:border-primary/30 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors"
            >
                <PencilLine className="size-4" />
                Disagree with this? Change the status
            </button>
        );
    }

    return (
        <section className="animate-fade-up rounded-lg border p-3">
            <h3 className="text-sm font-medium">Change status</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">Your reason is saved to the audit trail and shown to reviewers.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {statusOrder.map((s) => {
                    const meta = statusMeta[s];
                    const Icon = meta.icon;
                    const active = status === s;
                    return (
                        <button
                            key={s}
                            onClick={() => setStatus(s)}
                            aria-pressed={active}
                            className={cn(
                                'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-all',
                                active ? cn(meta.pill, 'border-transparent ring-2 ring-inset') : 'hover:bg-muted',
                            )}
                        >
                            <Icon className="size-3.5" />
                            {meta.label}
                        </button>
                    );
                })}
            </div>
            <label className="mt-3 block">
                <span className="sr-only">Reason</span>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. IT confirmed the renewed Cyber Essentials Plus certificate arrived this morning — uploading today."
                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/40 w-full resize-none rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2"
                />
            </label>
            <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-[11px]">
                    {status === current
                        ? 'Pick a different status'
                        : reason.trim().length < 10
                          ? 'Add a short reason (10+ characters)'
                          : 'Ready to save'}
                </span>
                <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        disabled={!valid}
                        onClick={() => {
                            onSave(status, reason.trim());
                            setEditing(false);
                            setReason('');
                        }}
                    >
                        Save change
                    </Button>
                </div>
            </div>
        </section>
    );
}
