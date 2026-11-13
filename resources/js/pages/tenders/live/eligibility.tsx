import { TenderHeader } from '@/components/ebis/tender-header';
import { EligibilityDashboard } from '@/components/eligibility/eligibility-dashboard';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { formatDate } from '@/lib/ebis';
import { canEdit } from '@/lib/roles';
import { type Qualification, qualificationMeta } from '@/lib/rules';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { EligibilityRow, Tender } from '@/types/ebis';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Info, ListChecks, Loader2, RefreshCw, Scale } from 'lucide-react';
import { useState } from 'react';

interface Run {
    id: string;
    verdict: Qualification;
    score: number;
    at: string;
    by: string;
    outdated: boolean;
}

const toneClass = {
    met: 'border-status-met/30 bg-status-met/[0.06] text-status-met',
    partial: 'border-status-partial/30 bg-status-partial/[0.06] text-status-partial',
    'not-met': 'border-status-not-met/30 bg-status-not-met/[0.06] text-status-not-met',
};

export default function LiveEligibility({
    tender,
    rows,
    run,
    confirmedCount,
}: {
    tender: Tender;
    rows: EligibilityRow[];
    run: Run | null;
    confirmedCount: number;
}) {
    const { role, auth, errors } = usePage<SharedData & { errors: Record<string, string> }>().props;
    const editable = canEdit(role);
    const [running, setRunning] = useState(false);

    const runCheck = () =>
        router.post(
            route('tenders.eligibility.run', tender.id),
            {},
            { preserveScroll: true, onStart: () => setRunning(true), onFinish: () => setRunning(false) },
        );

    const runButton = (label: string) => (
        <Button size="sm" onClick={runCheck} disabled={running || confirmedCount === 0}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} {label}
        </Button>
    );

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference || tender.title, href: route('tenders.show', tender.id) },
                { title: 'Eligibility', href: route('tenders.eligibility', tender.id) },
            ]}
        >
            <Head title={`Eligibility · ${tender.reference || tender.title}`} />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <TenderHeader
                    tender={tender}
                    viewing="eligibility"
                    actions={
                        <>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('tenders.requirements', tender.id)}>
                                    <ArrowLeft className="size-4" /> Requirements
                                </Link>
                            </Button>
                            {editable && run && runButton('Check again')}
                        </>
                    }
                />

                {errors?.requirements && (
                    <p role="alert" className="text-status-not-met text-sm">
                        {errors.requirements}
                    </p>
                )}

                {!run ? (
                    <section className="bg-card animate-fade-up flex flex-col items-center gap-3 rounded-2xl border p-10 text-center [animation-delay:60ms]">
                        <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
                            <Scale className="size-6" />
                        </span>
                        <h2 className="text-lg font-semibold tracking-tight">Check your eligibility</h2>
                        <p className="text-muted-foreground max-w-lg text-sm">
                            {confirmedCount > 0
                                ? `ProcurPilot checks each of the ${confirmedCount} confirmed requirements against your company profile and vault. Anything it can’t confirm is marked “Unknown”, never guessed.`
                                : 'Confirm the requirements first. Each one is then checked against your company profile and vault.'}
                        </p>
                        {confirmedCount > 0 ? (
                            editable && runButton('Run the check')
                        ) : (
                            <Button size="sm" asChild>
                                <Link href={route('tenders.requirements', tender.id)}>
                                    <ListChecks className="size-4" /> Go to requirements
                                </Link>
                            </Button>
                        )}
                    </section>
                ) : (
                    <>
                        <div
                            className={cn(
                                'animate-fade-up flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
                                toneClass[qualificationMeta[run.verdict].tone],
                            )}
                        >
                            <p>
                                <span className="font-semibold">{qualificationMeta[run.verdict].label}</span>
                                <span className="text-foreground/70"> · {qualificationMeta[run.verdict].hint}</span>
                            </p>
                            <p className="text-muted-foreground shrink-0 text-xs">
                                Checked {formatDate(run.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} by {run.by}
                            </p>
                        </div>

                        {run.outdated && (
                            <div className="bg-muted/50 flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                <p className="flex items-start gap-2">
                                    <Info className="text-primary mt-0.5 size-4 shrink-0" />
                                    Your requirements, profile or vault changed since this check. Check again to use the latest.
                                </p>
                                {editable && runButton('Check again')}
                            </div>
                        )}

                        <EligibilityDashboard
                            initialRows={rows}
                            canEdit={editable}
                            currentUserName={auth.user.name}
                            onOverride={(row, status, reason) =>
                                router.post(
                                    route('tenders.assessments.override', [tender.id, row.assessment.id]),
                                    { status, reason },
                                    { preserveScroll: true },
                                )
                            }
                            onToggleReviewed={(row) =>
                                router.post(route('tenders.assessments.review', [tender.id, row.assessment.id]), {}, { preserveScroll: true })
                            }
                        />
                    </>
                )}
            </div>
        </AppLayout>
    );
}
