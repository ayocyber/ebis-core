import { CompanyFields, type CompanyData } from '@/components/company-fields';
import { SavedNote, SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, Building2, Lock } from 'lucide-react';
import { FormEventHandler } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Company details', href: '/settings/company' },
];

interface Props {
    company: CompanyData & { id: string };
    canManage: boolean;
}

export default function CompanySettings({ company, canManage }: Props) {
    const { data, setData, patch, processing, errors, recentlySuccessful, isDirty } = useForm<CompanyData>({
        name: company.name,
        country: company.country,
        time_zone: company.time_zone,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('company.update'), { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Company details" />

            <SettingsLayout>
                <form onSubmit={submit}>
                    <SettingsCard
                        title="Company details"
                        description="Shown to your team and used for every deadline."
                        footer={
                            canManage ? (
                                <>
                                    <SavedNote show={recentlySuccessful} />
                                    <Button disabled={processing || !isDirty}>Save changes</Button>
                                </>
                            ) : (
                                <p className="text-muted-foreground mr-auto flex items-center gap-1.5 text-xs">
                                    <Lock className="size-3.5" /> Only an Owner can change these.
                                </p>
                            )
                        }
                    >
                        <CompanyFields data={data} errors={errors} onChange={(key, value) => setData(key, value)} disabled={!canManage} />
                    </SettingsCard>
                </form>

                <Link
                    href={route('company.profile')}
                    className="group bg-card hover:border-primary/30 flex items-center gap-4 rounded-2xl border p-5 transition-all hover:shadow-[0_16px_40px_-28px_var(--glow)]"
                >
                    <span className="bg-primary/8 text-primary dark:bg-primary/15 flex size-10 shrink-0 items-center justify-center rounded-xl">
                        <Building2 className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block font-medium">Company profile</span>
                        <span className="text-muted-foreground block text-sm">
                            Companies House and VAT numbers, turnover, insurance, certifications and people. EBIS checks tenders against these.
                        </span>
                    </span>
                    <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-all group-hover:translate-x-0.5" />
                </Link>
            </SettingsLayout>
        </AppLayout>
    );
}
