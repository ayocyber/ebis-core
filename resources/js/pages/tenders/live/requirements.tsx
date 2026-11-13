import { CategoryBadge } from '@/components/ebis/badges';
import { TenderHeader } from '@/components/ebis/tender-header';
import { RequirementFormDialog } from '@/components/requirements/requirement-form-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { categoryMeta, topicLabels } from '@/lib/ebis';
import { describeCheck } from '@/lib/requirements';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { Requirement, RequirementCategory, Tender } from '@/types/ebis';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Check, CheckCheck, FileSearch, FileText, ListChecks, Pencil, Plus, Scale, Trash2, X } from 'lucide-react';
import { useState } from 'react';

const order: RequirementCategory[] = ['mandatory', 'scored', 'informational'];

export default function LiveRequirements({
    tender,
    requirements,
    suggestions,
}: {
    tender: Tender;
    requirements: Requirement[];
    suggestions: Requirement[];
}) {
    const { role } = usePage<SharedData>().props;
    const editable = canEdit(role);
    const [form, setForm] = useState<{ editing?: Requirement } | null>(null);
    const [removing, setRemoving] = useState<Requirement | null>(null);
    const [busy, setBusy] = useState(false);

    const post = (url: string) => router.post(url, {}, { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => setBusy(false) });
    const mandatory = requirements.filter((r) => r.category === 'mandatory').length;

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference || tender.title, href: route('tenders.show', tender.id) },
                { title: 'Requirements', href: route('tenders.requirements', tender.id) },
            ]}
        >
            <Head title={`Requirements · ${tender.reference || tender.title}`} />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <TenderHeader
                    tender={tender}
                    viewing="requirements"
                    actions={
                        <>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('tenders.show', tender.id)}>
                                    <ArrowLeft className="size-4" /> Documents
                                </Link>
                            </Button>
                            {editable && (
                                <Button size="sm" onClick={() => setForm({})}>
                                    <Plus className="size-4" /> Add requirement
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Suggestions found in the text */}
                {suggestions.length > 0 && (
                    <section
                        aria-labelledby="sugg-title"
                        className="bg-card animate-fade-up rounded-2xl border shadow-[0_20px_60px_-40px_var(--glow)] [animation-delay:60ms]"
                    >
                        <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 id="sugg-title" className="flex items-center gap-2 font-semibold tracking-tight">
                                    <FileSearch className="text-primary size-4" /> Found in the documents ({suggestions.length})
                                </h2>
                                <p className="text-muted-foreground text-xs">
                                    Sentences that read like requirements. Check each one: confirm it, fix it, or dismiss it. Only confirmed
                                    requirements are checked.
                                </p>
                            </div>
                            {editable && suggestions.length > 1 && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => post(route('tenders.requirements.confirm', tender.id))}
                                >
                                    <CheckCheck className="size-4" /> Confirm all
                                </Button>
                            )}
                        </header>
                        <ul className="divide-y">
                            {suggestions.map((s) => (
                                <RequirementRow
                                    key={s.id}
                                    req={s}
                                    actions={
                                        editable && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    disabled={busy}
                                                    onClick={() => post(route('tenders.requirements.confirm', [tender.id, s.id]))}
                                                >
                                                    <Check className="size-4" /> Confirm
                                                </Button>
                                                <IconButton label="Edit" onClick={() => setForm({ editing: s })} icon={Pencil} />
                                                <IconButton
                                                    label="Dismiss"
                                                    onClick={() =>
                                                        router.delete(route('tenders.requirements.destroy', [tender.id, s.id]), {
                                                            preserveScroll: true,
                                                        })
                                                    }
                                                    icon={X}
                                                />
                                            </>
                                        )
                                    }
                                />
                            ))}
                        </ul>
                    </section>
                )}

                {/* Confirmed */}
                <section aria-labelledby="req-title" className="animate-fade-up space-y-4 [animation-delay:100ms]">
                    <div className="flex items-baseline justify-between gap-3">
                        <h2 id="req-title" className="flex items-center gap-2 text-base font-semibold">
                            <ListChecks className="text-primary size-4" /> Requirements
                            <span className="text-muted-foreground font-normal tabular-nums">({requirements.length})</span>
                        </h2>
                        {requirements.length > 0 && <p className="text-muted-foreground text-xs">{mandatory} mandatory</p>}
                    </div>

                    {requirements.length === 0 ? (
                        <div className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
                            {suggestions.length
                                ? 'Confirm the suggestions above, or add requirements yourself.'
                                : 'No requirements yet. Add the ones in the tender, starting with the mandatory selection criteria.'}
                        </div>
                    ) : (
                        order
                            .filter((c) => requirements.some((r) => r.category === c))
                            .map((c) => (
                                <div key={c} className="space-y-2">
                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{categoryMeta[c].label}</p>
                                    <ul className="bg-card divide-y overflow-hidden rounded-xl border shadow-xs">
                                        {requirements
                                            .filter((r) => r.category === c)
                                            .map((r) => (
                                                <RequirementRow
                                                    key={r.id}
                                                    req={r}
                                                    actions={
                                                        editable && (
                                                            <>
                                                                <IconButton label="Edit" onClick={() => setForm({ editing: r })} icon={Pencil} />
                                                                <IconButton label="Remove" onClick={() => setRemoving(r)} icon={Trash2} />
                                                            </>
                                                        )
                                                    }
                                                />
                                            ))}
                                    </ul>
                                </div>
                            ))
                    )}
                </section>

                <section className="from-primary/8 animate-fade-up rounded-2xl border bg-gradient-to-br to-transparent p-5 [animation-delay:140ms]">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                        <Scale className="text-primary size-4" /> Next: eligibility check
                    </p>
                    <p className="text-muted-foreground mt-1.5 text-sm">
                        Coming next: ProcurPilot checks each confirmed requirement against your company profile and vault, using the rule shown on it.
                    </p>
                </section>
            </div>

            {editable && (
                <>
                    <RequirementFormDialog tender={tender} editing={form?.editing} open={form !== null} onOpenChange={(o) => !o && setForm(null)} />
                    <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Remove {removing?.code}?</DialogTitle>
                                <DialogDescription>
                                    “{removing?.title}” will no longer be checked. The removal is recorded in the activity log.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setRemoving(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() =>
                                        removing &&
                                        router.delete(route('tenders.requirements.destroy', [tender.id, removing.id]), {
                                            preserveScroll: true,
                                            onFinish: () => setRemoving(null),
                                        })
                                    }
                                >
                                    Remove requirement
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </AppLayout>
    );
}

function RequirementRow({ req: r, actions }: { req: Requirement; actions?: React.ReactNode }) {
    const where = [r.source.documentName, r.source.page ? `page ${r.source.page}` : null, r.source.section ? `clause ${r.source.section}` : null]
        .filter(Boolean)
        .join(' · ');

    return (
        <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:px-5">
            <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                    {r.confirmed && r.code && <span className="text-muted-foreground font-mono text-xs">{r.code}</span>}
                    <CategoryBadge category={r.category} />
                    <span className="text-muted-foreground text-xs">{topicLabels[r.topic]}</span>
                    {r.category === 'scored' && r.weight ? <span className="text-muted-foreground text-xs">· {r.weight}%</span> : null}
                </div>
                <p className="text-sm leading-snug font-medium">{r.title}</p>
                {r.source.quote && r.source.quote !== r.title && (
                    <blockquote className="text-muted-foreground border-l-2 pl-3 text-xs leading-relaxed">“{r.source.quote}”</blockquote>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className={cn('flex items-center gap-1', r.check ? 'text-primary' : 'text-muted-foreground')}>
                        <Scale className="size-3.5" /> {describeCheck(r.check)}
                    </span>
                    {where && (
                        <span className="text-muted-foreground flex items-center gap-1">
                            <FileText className="size-3.5" /> {where}
                        </span>
                    )}
                </div>
            </div>
            {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </li>
    );
}

function IconButton({ label, onClick, icon: Icon }: { label: string; onClick: () => void; icon: typeof Pencil }) {
    return (
        <Button variant="ghost" size="icon" className="text-muted-foreground size-8" onClick={onClick} aria-label={label} title={label}>
            <Icon className="size-4" />
        </Button>
    );
}
