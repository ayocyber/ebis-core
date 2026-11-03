import { initials } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth-layout';
import { roleDescriptions } from '@/lib/roles';
import { type SharedData, type TenantRole } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowRight, Check, LinkIcon, Loader2, LogOut, Mail, UserPlus } from 'lucide-react';
import { useState } from 'react';

interface Props {
    token: string;
    invitation: { email: string; role: string; company: string | null } | null;
    emailMatches: boolean;
}

const roleKey = (role: string): TenantRole | null => {
    const r = role.toLowerCase();
    return r === 'owner' || r === 'editor' || r === 'viewer' ? r : null;
};

export default function AcceptInvitation({ token, invitation, emailMatches }: Props) {
    const { auth, flash } = usePage<SharedData>().props;
    const user = auth.user;
    const [accepting, setAccepting] = useState(false);

    if (!invitation) {
        return (
            <AuthLayout title="This invitation can’t be used" description="The link has expired or was already used.">
                <Head title="Invitation" />
                <div className="bg-muted/50 flex items-start gap-3 rounded-xl p-4 text-sm">
                    <LinkIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <p className="text-muted-foreground">Ask the person who invited you to send a new one. Invitation links work for 7 days.</p>
                </div>
                <Button asChild variant="outline" className="h-11 w-full">
                    <Link href={route(user ? 'dashboard' : 'login')}>{user ? 'Go to your dashboard' : 'Sign in'}</Link>
                </Button>
            </AuthLayout>
        );
    }

    const company = invitation.company ?? 'the company';
    const key = roleKey(invitation.role);

    const accept = () => {
        setAccepting(true);
        router.post(route('invitations.accept', token), {}, { onFinish: () => setAccepting(false) });
    };

    return (
        <AuthLayout title={`Join ${company}`} description="You’ve been invited to work on tenders together in EBIS Core.">
            <Head title={`Join ${company}`} />

            <div className="bg-card overflow-hidden rounded-2xl border">
                <div className="flex items-center gap-3 border-b p-4">
                    <span className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold shadow-[0_10px_28px_-12px_var(--glow)]">
                        {initials(company)}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate font-semibold">{company}</p>
                        <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                            <Mail className="size-3" /> {invitation.email}
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-4">
                    <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize">{invitation.role}</span>
                    <p className="text-muted-foreground text-sm">{key ? roleDescriptions[key] : 'Access to this company’s tenders'}</p>
                </div>
            </div>

            {flash?.error && (
                <p role="alert" className="text-status-not-met text-center text-sm">
                    {flash.error}
                </p>
            )}

            {!user && (
                <div className="flex flex-col gap-3">
                    <Button asChild className="h-11 shadow-[0_10px_28px_-12px_var(--glow)]">
                        <Link href={route('register')}>
                            <UserPlus className="size-4" /> Create an account
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11">
                        <Link href={route('login')}>I already have an account</Link>
                    </Button>
                    <p className="text-muted-foreground text-center text-xs">
                        Use <span className="text-foreground font-medium">{invitation.email}</span>. You’ll come back here afterwards.
                    </p>
                </div>
            )}

            {user && emailMatches && (
                <div className="space-y-3">
                    <Button onClick={accept} disabled={accepting} className="h-11 w-full shadow-[0_10px_28px_-12px_var(--glow)]">
                        {accepting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Accept and join {company}
                        {!accepting && <ArrowRight className="size-4" />}
                    </Button>
                    <p className="text-muted-foreground text-center text-xs">Signed in as {user.email}</p>
                </div>
            )}

            {user && !emailMatches && (
                <div className="space-y-3">
                    <div className="border-status-partial/30 bg-status-partial/[0.06] rounded-xl border p-4 text-sm">
                        You’re signed in as <strong>{user.email}</strong>, but this invitation is for <strong>{invitation.email}</strong>.
                    </div>
                    <Button asChild variant="outline" className="h-11 w-full">
                        <Link href={route('logout')} method="post" as="button">
                            <LogOut className="size-4" /> Sign out and use {invitation.email}
                        </Link>
                    </Button>
                </div>
            )}
        </AuthLayout>
    );
}
