import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import { initials, SavedNote, SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { roleLabel } from '@/lib/roles';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { BadgeCheck, MailWarning } from 'lucide-react';
import { FormEventHandler } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Profile', href: '/settings/profile' },
];

export default function Profile({ mustVerifyEmail, status }: { mustVerifyEmail: boolean; status?: string }) {
    const { auth, tenant, role } = usePage<SharedData>().props;

    const { data, setData, patch, errors, processing, recentlySuccessful, isDirty } = useForm({
        name: auth.user.name,
        email: auth.user.email,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('profile.update'), { preserveScroll: true });
    };

    const unverified = mustVerifyEmail && auth.user.email_verified_at === null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Profile" />

            <SettingsLayout>
                {/* Identity */}
                <div className="bg-card relative overflow-hidden rounded-2xl border p-5 sm:p-6">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_0%_0%,color-mix(in_oklab,var(--glow)_14%,transparent),transparent_70%)]"
                    />
                    <div className="relative flex items-center gap-4">
                        <span className="bg-primary text-primary-foreground flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold shadow-[0_10px_28px_-12px_var(--glow)]">
                            {initials(data.name || auth.user.name)}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-lg font-semibold tracking-tight">{data.name || auth.user.name}</p>
                            <p className="text-muted-foreground truncate text-sm">{auth.user.email}</p>
                            {tenant && role && (
                                <p className="text-muted-foreground mt-1 text-xs">
                                    {roleLabel(role)} at <span className="text-foreground font-medium">{tenant.name}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <form onSubmit={submit}>
                    <SettingsCard
                        title="Profile information"
                        description="Your name appears on decisions, sign-offs and the audit log."
                        footer={
                            <>
                                <SavedNote show={recentlySuccessful} />
                                <Button disabled={processing || !isDirty}>Save changes</Button>
                            </>
                        }
                    >
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Full name</Label>
                                <Input
                                    id="name"
                                    className="h-10"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    required
                                    autoComplete="name"
                                    placeholder="Full name"
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email" className="flex items-center justify-between gap-2">
                                    Email address
                                    {!unverified && auth.user.email_verified_at && (
                                        <span className="text-status-met flex items-center gap-1 text-xs font-medium">
                                            <BadgeCheck className="size-3.5" /> Verified
                                        </span>
                                    )}
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    className="h-10"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    required
                                    autoComplete="username"
                                    placeholder="you@company.co.uk"
                                />
                                <InputError message={errors.email} />
                            </div>
                        </div>

                        {unverified && (
                            <div className="border-status-partial/30 bg-status-partial/[0.06] mt-5 flex items-start gap-3 rounded-xl border p-3 text-sm">
                                <MailWarning className="text-status-partial mt-0.5 size-4 shrink-0" />
                                <div>
                                    <p>
                                        Your email address isn’t verified yet.{' '}
                                        <Link
                                            href={route('verification.send')}
                                            method="post"
                                            as="button"
                                            className="text-primary font-medium underline-offset-4 hover:underline"
                                        >
                                            Send the link again
                                        </Link>
                                    </p>
                                    {status === 'verification-link-sent' && (
                                        <p className="text-status-met mt-1 text-xs font-medium">A new verification link is on its way.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </SettingsCard>
                </form>

                <DeleteUser />
            </SettingsLayout>
        </AppLayout>
    );
}
