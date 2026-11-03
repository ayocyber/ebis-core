import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { Monitor, Moon, Sun } from 'lucide-react';

const options = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'system', icon: Monitor, label: 'System' },
    { value: 'dark', icon: Moon, label: 'Dark' },
] as const;

/** Compact segmented light / system / dark switch. */
export function ThemeToggle({ className }: { className?: string }) {
    const { appearance, updateAppearance } = useAppearance();

    return (
        <div role="radiogroup" aria-label="Theme" className={cn('bg-muted/60 inline-flex items-center gap-0.5 rounded-full border p-0.5', className)}>
            {options.map(({ value, icon: Icon, label }) => {
                const active = appearance === value;
                return (
                    <button
                        key={value}
                        role="radio"
                        aria-checked={active}
                        aria-label={label}
                        title={label}
                        onClick={() => updateAppearance(value)}
                        className={cn(
                            'flex size-7 items-center justify-center rounded-full transition-all',
                            active
                                ? 'bg-card text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Icon className="size-3.5" />
                    </button>
                );
            })}
        </div>
    );
}
