import InputError from '@/components/input-error';
import { initials, SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { roleDescriptions, roleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type TenantRole } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Clock, Crown, Eye, Mail, PenLine, Send, UserMinus, X } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Team members', href: '/settings/members' },
];

interface Member {
    id: number;
    name: string;
    email: string;
    role: TenantRole;
    isYou: boolean;
}

interface PendingInvitation {
    id: string;
    email: string;
    role: TenantRole;
    expiresAt: string;
}

interface Props {
    members: Member[];
    invitations: PendingInvitation[];
    roles: { value: TenantRole; label: string }[];
    canManage: boolean;
}

const roleIcon: Record<TenantRole, typeof Crown> = { owner: Crown, editor: PenLine, viewer: Eye };

const selectClass =
    'border-input bg-background focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-xs font-medium shadow-xs focus-visible:ring-[3px] focus-visible:outline-none';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export default function Members({ members, invitations, roles, canManage }: Props) {
    const invite = useForm<{ email: string; role: TenantRole }>({ email: '', role: 'editor' });
    const [removing, setRemoving] = useState<Member | null>(null);

    const sendInvite: FormEventHandler = (e) => {
        e.preventDefault();
        invite.post(route('invitations.store'), { preserveScroll: true, onSuccess: () => invite.reset('email') });
    };

    const changeRole = (member: Member, role: TenantRole) => router.patch(route('members.update', member.id), { role }, { preserveScroll: true });

    const confirmRemove = () => {
        if (!removing) return;
        router.delete(route('members.destroy', removing.id), { preserveScroll: true, onFinish: () => setRemoving(null) });
    };

    const cancelInvite = (invitation: PendingInvitation) => router.delete(route('invitations.destroy', invitation.id), { preserveScroll: true });

    const counts = roles.map((r) => ({ ...r, n: members.filter((m) => m.role === r.value).length }));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Team members" />

            <SettingsLayout>
                <SettingsCard
                    title="Team members"
                    description={
                        <>
                            Everyone who can see this company’s tenders and evidence ·{' '}
                            {counts
                                .filter((c) => c.n)
                                .map((c) => `${c.n} ${c.label}${c.n > 1 ? 's' : ''}`)
                                .join(', ')}
                        </>
                    }
                >
                    <ul className="-my-2 divide-y">
                        {members.map((member) => {
                            const Icon = roleIcon[member.role];
                            return (
                                <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                                    <span
                                        className={cn(
                                            'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                            member.isYou ? 'bg-primary text-primary-foreground' : 'bg-muted',
                                        )}
                                    >
                                        {initials(member.name)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">
                                            {member.name} {member.isYou && <span className="text-muted-foreground font-normal">(you)</span>}
                                        </p>
                                        <p className="text-muted-foreground truncate text-xs">{member.email}</p>
                                    </div>

                                    {canManage && !member.isYou ? (
                                        <div className="flex items-center gap-1">
                                            <label className="sr-only" htmlFor={`role-${member.id}`}>
                                                Role for {member.name}
                                            </label>
                                            <select
                                                id={`role-${member.id}`}
                                                className={selectClass}
                                                value={member.role}
                                                onChange={(e) => changeRole(member, e.target.value as TenantRole)}
                                            >
                                                {roles.map((r) => (
                                                    <option key={r.value} value={r.value}>
                                                        {r.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="hover:text-status-not-met size-8"
                                                onClick={() => setRemoving(member)}
                                                aria-label={`Remove ${member.name}`}
                                            >
                                                <UserMinus className="size-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <span className="bg-muted text-muted-foreground flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
                                            <Icon className="size-3.5" /> {roleLabel(member.role)}
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </SettingsCard>

                {canManage && (
                    <form onSubmit={sendInvite}>
                        <SettingsCard
                            title="Invite someone"
                            description="They get an email with a link that works for 7 days."
                            footer={
                                <Button disabled={invite.processing || !invite.data.email}>
                                    <Send className="size-4" /> Send invitation
                                </Button>
                            }
                        >
                            <div className="space-y-5">
                                <div className="grid gap-2">
                                    <Label htmlFor="invite-email">Work email</Label>
                                    <div className="relative">
                                        <Mail className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                        <Input
                                            id="invite-email"
                                            type="email"
                                            className="h-10 pl-9"
                                            value={invite.data.email}
                                            onChange={(e) => invite.setData('email', e.target.value)}
                                            placeholder="colleague@company.co.uk"
                                            required
                                        />
                                    </div>
                                    <InputError message={invite.errors.email} />
                                </div>

                                <fieldset>
                                    <legend className="mb-2 text-sm font-medium">What can they do?</legend>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {roles.map((r) => {
                                            const Icon = roleIcon[r.value];
                                            const on = invite.data.role === r.value;
                                            return (
                                                <label
                                                    key={r.value}
                                                    className={cn(
                                                        'relative cursor-pointer rounded-xl border p-3 transition-all',
                                                        on ? 'border-primary bg-primary/[0.05] ring-primary/20 ring-2' : 'hover:border-primary/40',
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="invite-role"
                                                        value={r.value}
                                                        checked={on}
                                                        onChange={() => invite.setData('role', r.value)}
                                                        className="sr-only"
                                                    />
                                                    <span className="flex items-center gap-2 text-sm font-medium">
                                                        <Icon className={cn('size-4', on ? 'text-primary' : 'text-muted-foreground')} />
                                                        {r.label}
                                                    </span>
                                                    <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                                                        {roleDescriptions[r.value]}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <InputError message={invite.errors.role} />
                                </fieldset>
                            </div>
                        </SettingsCard>
                    </form>
                )}

                {canManage && invitations.length > 0 && (
                    <SettingsCard title="Waiting to accept" description="Invitations that haven’t been used yet.">
                        <ul className="-my-2 divide-y">
                            {invitations.map((i) => (
                                <li key={i.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                                    <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed">
                                        <Mail className="size-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium">{i.email}</span>
                                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                            <Clock className="size-3" /> {roleLabel(i.role)} · link works until{' '}
                                            {dateFormat.format(new Date(i.expiresAt))}
                                        </span>
                                    </span>
                                    <Button variant="ghost" size="sm" onClick={() => cancelInvite(i)}>
                                        <X className="size-4" /> Cancel
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </SettingsCard>
                )}
            </SettingsLayout>

            <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
                <DialogContent>
                    <DialogTitle>Remove {removing?.name}?</DialogTitle>
                    <DialogDescription>
                        They lose access to this company’s tenders, evidence and bids straight away. Their past work and audit log entries stay.
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="secondary">Cancel</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={confirmRemove}>
                            Remove from company
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
