import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { Building2, KeyRound, type LucideIcon, Palette, UserRound, Users } from 'lucide-react';

const groups: { label: string; items: { title: string; url: string; icon: LucideIcon; hint: string }[] }[] = [
    {
        label: 'Your account',
        items: [
            { title: 'Profile', url: '/settings/profile', icon: UserRound, hint: 'Name and email' },
            { title: 'Password', url: '/settings/password', icon: KeyRound, hint: 'Sign-in security' },
            { title: 'Appearance', url: '/settings/appearance', icon: Palette, hint: 'Light or dark' },
        ],
    },
    {
        label: 'Company',
        items: [
            { title: 'Company details', url: '/settings/company', icon: Building2, hint: 'Name, country, deadlines' },
            { title: 'Team members', url: '/settings/members', icon: Users, hint: 'People and roles' },
        ],
    },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const all = groups.flatMap((g) => g.items);

    return (
        <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
            <div className="animate-fade-up">
                <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1 text-sm">Your account and your company.</p>
            </div>

            {/* Mobile: horizontal tabs */}
            <nav aria-label="Settings" className="-mx-4 overflow-x-auto border-b px-4 [scrollbar-width:none] lg:hidden">
                <ul className="flex min-w-max gap-1">
                    {all.map((item) => {
                        const active = currentPath === item.url;
                        return (
                            <li key={item.url}>
                                <Link
                                    href={item.url}
                                    prefetch
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                                        active ? 'border-primary text-foreground' : 'text-muted-foreground hover:text-foreground border-transparent',
                                    )}
                                >
                                    <item.icon className="size-4" />
                                    {item.title}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
                {/* Desktop: grouped side nav */}
                <aside className="hidden lg:block">
                    <nav aria-label="Settings" className="sticky top-20 space-y-6">
                        {groups.map((g) => (
                            <div key={g.label}>
                                <p className="text-muted-foreground mb-2 px-3 text-[11px] font-semibold tracking-[0.12em] uppercase">{g.label}</p>
                                <ul className="space-y-0.5">
                                    {g.items.map((item) => {
                                        const active = currentPath === item.url;
                                        return (
                                            <li key={item.url}>
                                                <Link
                                                    href={item.url}
                                                    prefetch
                                                    aria-current={active ? 'page' : undefined}
                                                    className={cn(
                                                        'group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                                                        active ? 'bg-primary/8 dark:bg-primary/15' : 'hover:bg-muted/60',
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                                                            active
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'bg-muted text-muted-foreground group-hover:text-foreground',
                                                        )}
                                                    >
                                                        <item.icon className="size-4" />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className={cn('block text-sm font-medium', !active && 'text-foreground/90')}>
                                                            {item.title}
                                                        </span>
                                                        <span className="text-muted-foreground block truncate text-xs">{item.hint}</span>
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </aside>

                <div className="animate-fade-up max-w-3xl min-w-0 space-y-6 [animation-delay:60ms]">{children}</div>
            </div>
        </div>
    );
}
