import InputError from '@/components/input-error';
import { SavedNote, SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { FormEventHandler, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Password', href: '/settings/password' },
];

/** Rough guide only; the server enforces the real rules. */
function strength(pw: string) {
    const checks = [
        { label: 'At least 12 characters', ok: pw.length >= 12 },
        { label: 'Upper and lower case letters', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
        { label: 'A number or symbol', ok: /[\d\W_]/.test(pw) },
    ];
    const score = checks.filter((c) => c.ok).length + (pw.length >= 16 ? 1 : 0);
    const label = !pw ? '' : score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
    return { checks, score, label };
}

export default function Password() {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);
    const [show, setShow] = useState(false);

    const { data, setData, errors, put, reset, processing, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const s = strength(data.password);
    const mismatch = !!data.password_confirmation && data.password !== data.password_confirmation;

    const updatePassword: FormEventHandler = (e) => {
        e.preventDefault();
        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current?.focus();
                }
                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current?.focus();
                }
            },
        });
    };

    const type = show ? 'text' : 'password';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Password" />

            <SettingsLayout>
                <form onSubmit={updatePassword}>
                    <SettingsCard
                        title="Change password"
                        description="Use a long password you don’t use anywhere else. A password manager makes this easy."
                        footer={
                            <>
                                <SavedNote show={recentlySuccessful} />
                                <Button disabled={processing || !data.current_password || !data.password || mismatch}>Update password</Button>
                            </>
                        }
                    >
                        <div className="space-y-5">
                            <div className="grid gap-2">
                                <Label htmlFor="current_password">Current password</Label>
                                <Input
                                    id="current_password"
                                    ref={currentPasswordInput}
                                    value={data.current_password}
                                    onChange={(e) => setData('current_password', e.target.value)}
                                    type={type}
                                    className="h-10"
                                    autoComplete="current-password"
                                />
                                <InputError message={errors.current_password} />
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="password">New password</Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            ref={passwordInput}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            type={type}
                                            className="h-10 pr-10"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShow((v) => !v)}
                                            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
                                            aria-label={show ? 'Hide passwords' : 'Show passwords'}
                                        >
                                            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                        </button>
                                    </div>
                                    <InputError message={errors.password} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="password_confirmation">Confirm new password</Label>
                                    <Input
                                        id="password_confirmation"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        type={type}
                                        className={cn('h-10', mismatch && 'border-status-not-met/60')}
                                        autoComplete="new-password"
                                    />
                                    {mismatch ? (
                                        <p className="text-status-not-met text-xs">Doesn’t match the new password</p>
                                    ) : (
                                        <InputError message={errors.password_confirmation} />
                                    )}
                                </div>
                            </div>

                            {data.password && (
                                <div className="bg-muted/40 animate-fade-up space-y-3 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-1 gap-1" aria-hidden>
                                            {[1, 2, 3, 4].map((n) => (
                                                <span
                                                    key={n}
                                                    className={cn(
                                                        'h-1.5 flex-1 rounded-full transition-colors',
                                                        n <= s.score
                                                            ? s.score <= 1
                                                                ? 'bg-status-not-met'
                                                                : s.score === 2
                                                                  ? 'bg-status-partial'
                                                                  : 'bg-status-met'
                                                            : 'bg-muted',
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <span className="w-14 text-right text-xs font-medium">{s.label}</span>
                                    </div>
                                    <ul className="grid gap-1 text-xs sm:grid-cols-3">
                                        {s.checks.map((c) => (
                                            <li
                                                key={c.label}
                                                className={cn('flex items-center gap-1.5', c.ok ? 'text-status-met' : 'text-muted-foreground')}
                                            >
                                                <Check className={cn('size-3.5', !c.ok && 'opacity-30')} /> {c.label}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </SettingsCard>
                </form>

                <div className="text-muted-foreground flex items-start gap-3 rounded-2xl border border-dashed p-4 text-sm">
                    <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
                    <p>If you think someone else knows your password, change it now and tell your company’s Owner.</p>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
