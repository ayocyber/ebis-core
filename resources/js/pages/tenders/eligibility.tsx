import { TenderHeader } from '@/components/ebis/tender-header';
import { EligibilityDashboard } from '@/components/eligibility/eligibility-dashboard';
import { Button } from '@/components/ui/button';
import { eligibilityRowsFor, findTender } from '@/data/mock-ebis';
import AppLayout from '@/layouts/app-layout';
import { canEdit } from '@/lib/roles';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Download, FileQuestion } from 'lucide-react';
import { useMemo } from 'react';

export default function TenderEligibility({ tenderId }: { tenderId: string }) {
    const { role, auth } = usePage<SharedData>().props;
    const tender = findTender(tenderId);
    const rows = useMemo(() => eligibilityRowsFor(tenderId), [tenderId]);

    if (!tender) {
        return (
            <AppLayout breadcrumbs={[{ title: 'Tenders', href: '/tenders' }]}>
                <Head title="Tender not found" />
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                    <FileQuestion className="text-muted-foreground size-10" />
                    <p className="font-medium">We couldn’t find that tender.</p>
                    <Button asChild variant="outline">
                        <Link href={route('tenders.index')}>Back to tenders</Link>
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Tenders', href: '/tenders' },
                { title: tender.reference, href: `/tenders/${tender.id}/eligibility` },
                { title: 'Eligibility', href: `/tenders/${tender.id}/eligibility` },
            ]}
        >
            <Head title={`Eligibility · ${tender.reference}`} />

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
                            <Button variant="outline" size="sm" disabled title="Export arrives with the compliance matrix">
                                <Download className="size-4" /> Export
                            </Button>
                            <Button size="sm" asChild>
                                <Link href={route('tenders.gaps', tender.id)}>
                                    Continue to gaps <ArrowRight className="size-4" />
                                </Link>
                            </Button>
                        </>
                    }
                />

                <EligibilityDashboard initialRows={rows} canEdit={canEdit(role)} currentUserName={auth.user.name} />
            </div>
        </AppLayout>
    );
}
