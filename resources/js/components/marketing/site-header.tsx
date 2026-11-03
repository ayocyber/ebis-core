import AppLogoIcon from '@/components/app-logo-icon';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export const siteLinks = [
    { href: '#product', label: 'Product' },
    { href: '#features', label: 'Features' },
    { href: '#workflow', label: 'Workflow' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
];

export function SiteLogo({ className }: { className?: string }) {
    return (
        <Link href={route('home')} className={cn('flex items-center gap-2.5', className)}>
            <AppLogoIcon className="size-8 drop-shadow-[0_4px_12px_rgba(35,45,240,0.45)]" />
            <span className="text-[15px] font-semibold tracking-tight">EBIS Core</span>
        </Link>
    );
}

export function SiteHeader() {
    const { auth } = usePage<SharedData>().props;
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <header
            className={cn(
                'sticky top-0 z-50 transition-all duration-300',
                scrolled || open ? 'bg-background/75 border-b backdrop-blur-xl backdrop-saturate-150' : 'border-b border-transparent',
            )}
        >
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 2xl:max-w-[1400px]">
                <SiteLogo />

                <nav className="hidden items-center gap-1 md:flex">
                    {siteLinks.map((l) => (
                        <a
                            key={l.href}
                            href={l.href}
                            className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-sm transition-colors"
                        >
                            {l.label}
                        </a>
                    ))}
                </nav>

                <div className="hidden items-center gap-2 md:flex">
                    <ThemeToggle />
                    {auth.user ? (
                        <Button asChild size="sm" className="rounded-full px-4">
                            <Link href={route('dashboard')}>
                                Open app <ArrowRight />
                            </Link>
                        </Button>
                    ) : (
                        <>
                            <Button asChild size="sm" variant="ghost" className="rounded-full">
                                <Link href={route('login')}>Sign in</Link>
                            </Button>
                            <Button
                                asChild
                                size="sm"
                                className="rounded-full px-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_8px_24px_-8px_var(--glow)]"
                            >
                                <Link href={route('register')}>Get started</Link>
                            </Button>
                        </>
                    )}
                </div>

                <button
                    className="hover:bg-muted -mr-2 rounded-full p-2 md:hidden"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    aria-label={open ? 'Close menu' : 'Open menu'}
                >
                    {open ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
            </div>

            {open && (
                <div className="animate-fade-up border-t px-4 pt-2 pb-5 md:hidden">
                    <nav className="grid">
                        {siteLinks.map((l) => (
                            <a
                                key={l.href}
                                href={l.href}
                                onClick={() => setOpen(false)}
                                className="hover:bg-muted rounded-lg px-3 py-3 text-sm font-medium"
                            >
                                {l.label}
                            </a>
                        ))}
                    </nav>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t pt-4">
                        <ThemeToggle />
                        <div className="flex gap-2">
                            {auth.user ? (
                                <Button asChild size="sm" className="rounded-full">
                                    <Link href={route('dashboard')}>Open app</Link>
                                </Button>
                            ) : (
                                <>
                                    <Button asChild size="sm" variant="outline" className="rounded-full">
                                        <Link href={route('login')}>Sign in</Link>
                                    </Button>
                                    <Button asChild size="sm" className="rounded-full">
                                        <Link href={route('register')}>Get started</Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
