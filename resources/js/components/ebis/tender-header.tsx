import { DeadlineChip } from '@/components/ebis/badges';
import { StageStepper } from '@/components/ebis/stage-stepper';
import { daysUntil, formatDate, formatMoney } from '@/lib/ebis';
import type { Tender, TenderStage } from '@/types/ebis';
import { Link } from '@inertiajs/react';
import { ArrowLeft, Building2, CalendarDays, FileStack, Hash, History, Wallet } from 'lucide-react';

export function TenderHeader({ tender, viewing, actions }: { tender: Tender; viewing?: TenderStage; actions?: React.ReactNode }) {
    const days = daysUntil(tender.deadline);

    return (
        <div className="animate-fade-up space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                    <Link
                        href={route('tenders.index')}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
                    >
                        <ArrowLeft className="size-3.5" /> All tenders
                    </Link>
                    <h1 className="text-xl leading-tight font-semibold tracking-tight text-balance sm:text-2xl">{tender.title}</h1>
                    <dl className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                        <Meta icon={Building2} label="Buyer">
                            {tender.buyer.name}
                        </Meta>
                        <Meta icon={Hash} label="Reference">
                            <span className="font-mono text-xs">{tender.reference}</span>
                        </Meta>
                        <Meta icon={Wallet} label="Estimated value">
                            {formatMoney(tender.estimatedValue)}
                        </Meta>
                        <Meta icon={CalendarDays} label="Deadline">
                            {formatDate(tender.deadline, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Meta>
                        <Meta icon={FileStack} label="Documents">
                            {tender.documents.length} docs
                        </Meta>
                        <DeadlineChip days={days} />
                        <Link
                            href={route('activity.index', { tender: tender.id })}
                            className="hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
                        >
                            <History className="size-3.5" /> History
                        </Link>
                    </dl>
                </div>
                {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>
            <StageStepper current={tender.stage} viewing={viewing} />
        </div>
    );
}

function Meta({ icon: Icon, label, children }: { icon: typeof Building2; label: string; children: React.ReactNode }) {
    return (
        <div className="flex min-w-0 items-center gap-1.5">
            <dt className="sr-only">{label}</dt>
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <dd className="text-foreground/80 truncate">{children}</dd>
        </div>
    );
}
