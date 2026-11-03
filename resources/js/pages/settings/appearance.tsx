import { SettingsCard } from '@/components/settings/settings-card';
import { type Appearance, useAppearance } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Check, type LucideIcon, Monitor, Moon, Sun } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Appearance', href: '/settings/appearance' },
];

const options: { value: Appearance; label: string; hint: string; icon: LucideIcon }[] = [
    { value: 'light', label: 'Light', hint: 'Bright and clear', icon: Sun },
    { value: 'dark', label: 'Dark', hint: 'Easier on the eyes at night', icon: Moon },
    { value: 'system', label: 'Match my device', hint: 'Follows your computer’s setting', icon: Monitor },
];

/** A tiny picture of the app in a given theme. Colours are fixed so each preview shows its own theme. */
function Preview({ mode }: { mode: 'light' | 'dark' }) {
    const dark = mode === 'dark';
    return (
        <div className={cn('flex h-full w-full overflow-hidden', dark ? 'bg-[#0b0d1a]' : 'bg-[#f6f7fb]')}>
            <div className={cn('w-1/4 space-y-1.5 border-r p-2', dark ? 'border-white/10 bg-[#11142a]' : 'border-black/5 bg-white')}>
                <div className="h-2 w-3/4 rounded-sm bg-[hsl(236,88%,50%)]" />
                {[0, 1, 2].map((i) => (
                    <div key={i} className={cn('h-1.5 rounded-sm', dark ? 'bg-white/15' : 'bg-black/10')} />
                ))}
            </div>
            <div className="flex-1 space-y-2 p-2.5">
                <div className={cn('h-2 w-1/2 rounded-sm', dark ? 'bg-white/70' : 'bg-black/70')} />
                <div className="grid grid-cols-3 gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className={cn('h-6 rounded', dark ? 'bg-white/[0.06] ring-1 ring-white/10' : 'bg-white ring-1 ring-black/5')} />
                    ))}
                </div>
                <div className={cn('h-10 rounded', dark ? 'bg-white/[0.06] ring-1 ring-white/10' : 'bg-white ring-1 ring-black/5')}>
                    <div className="m-1.5 h-1.5 w-1/3 rounded-sm bg-[hsl(358,78%,52%)]/80" />
                </div>
            </div>
        </div>
    );
}

export default function AppearancePage() {
    const { appearance, updateAppearance } = useAppearance();

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Appearance" />

            <SettingsLayout>
                <SettingsCard title="Theme" description="Choose how EBIS Core looks on this device. Saved straight away.">
                    <div className="grid gap-4 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
                        {options.map((o) => {
                            const active = appearance === o.value;
                            return (
                                <button
                                    key={o.value}
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => updateAppearance(o.value)}
                                    className={cn(
                                        'group overflow-hidden rounded-xl border text-left transition-all',
                                        active ? 'border-primary ring-primary/20 ring-2' : 'hover:border-primary/40',
                                    )}
                                >
                                    <div className="relative aspect-[16/10] border-b">
                                        {o.value === 'system' ? (
                                            <div className="flex h-full">
                                                <div className="w-1/2 overflow-hidden">
                                                    <Preview mode="light" />
                                                </div>
                                                <div className="w-1/2 overflow-hidden">
                                                    <Preview mode="dark" />
                                                </div>
                                            </div>
                                        ) : (
                                            <Preview mode={o.value} />
                                        )}
                                        {active && (
                                            <span className="bg-primary text-primary-foreground absolute top-2 right-2 flex size-5 items-center justify-center rounded-full">
                                                <Check className="size-3" strokeWidth={3} />
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-start gap-2.5 p-3">
                                        <o.icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                                        <div>
                                            <p className="text-sm font-medium">{o.label}</p>
                                            <p className="text-muted-foreground text-xs">{o.hint}</p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </SettingsCard>
            </SettingsLayout>
        </AppLayout>
    );
}
