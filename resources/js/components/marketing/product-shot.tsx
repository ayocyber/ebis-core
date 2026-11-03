import AppLogoIcon from '@/components/app-logo-icon';
import { StatusBadge } from '@/components/ebis/badges';
import { statusMeta } from '@/lib/ebis';
import { cn } from '@/lib/utils';
import type { AssessmentStatus } from '@/types/ebis';
import { Building2, FileSearch, FileText, FolderLock, LayoutGrid, Quote, Search, Sparkles, Users } from 'lucide-react';

const rows: { code: string; title: string; status: AssessmentStatus; tag?: string }[] = [
    { code: 'M-01', title: 'Evidence of company registration', status: 'partially_met', tag: 'Fixable' },
    { code: 'M-02', title: 'HMRC tax compliance', status: 'met' },
    { code: 'M-03', title: 'Cyber Essentials Plus certificate', status: 'not_met', tag: 'Blocker' },
    { code: 'M-06', title: 'Central Digital Platform registration', status: 'met' },
    { code: 'M-07', title: 'Average turnover ≥ £2m', status: 'not_met', tag: 'Blocker' },
    { code: 'M-10', title: 'OEM manufacturer authorisation', status: 'unknown' },
    { code: 'S-02', title: 'Key personnel qualifications', status: 'met' },
];

/**
 * A faithful, static miniature of the eligibility screen for the hero.
 * Built from real components so it always matches the product.
 */
export function ProductShot() {
    return (
        <div className="relative">
            {/* glow under the frame */}
            <div aria-hidden className="bg-glow/40 dark:bg-glow/30 absolute inset-x-10 -bottom-10 h-40 rounded-full blur-[90px]" />

            <div className="from-border via-primary/30 to-border relative rounded-[18px] bg-gradient-to-b p-px shadow-2xl shadow-slate-900/10 dark:from-white/15 dark:via-white/5 dark:to-transparent dark:shadow-black/50">
                <div className="bg-background overflow-hidden rounded-[17px]">
                    {/* window chrome */}
                    <div className="bg-muted/40 flex h-10 items-center gap-2 border-b px-4">
                        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                        <span className="size-2.5 rounded-full bg-[#febc2e]" />
                        <span className="size-2.5 rounded-full bg-[#28c840]" />
                        <div className="bg-background text-muted-foreground mx-auto hidden h-6 w-72 items-center justify-center gap-1.5 rounded-md border text-[11px] sm:flex">
                            <Search className="size-3" /> EBIS Core · Tenders · NCC/ICT/2026/014
                        </div>
                    </div>

                    <div className="flex h-[440px] sm:h-[480px] 2xl:h-[520px]">
                        {/* sidebar */}
                        <aside className="bg-sidebar hidden w-48 shrink-0 flex-col gap-1 border-r p-3 md:flex">
                            <div className="mb-3 flex items-center gap-2 px-1">
                                <AppLogoIcon className="size-6" />
                                <span className="text-xs font-semibold">Bluewave Networks</span>
                            </div>
                            {[
                                [LayoutGrid, 'Dashboard', false],
                                [FileSearch, 'Tenders', true],
                                [FolderLock, 'Evidence vault', false],
                                [Building2, 'Company profile', false],
                                [Users, 'Team', false],
                            ].map(([Icon, label, active]) => {
                                const I = Icon as typeof LayoutGrid;
                                return (
                                    <div
                                        key={label as string}
                                        className={cn(
                                            'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                                            active ? 'bg-sidebar-accent text-foreground font-medium' : 'text-muted-foreground',
                                        )}
                                    >
                                        <I className="size-3.5" /> {label as string}
                                    </div>
                                );
                            })}
                        </aside>

                        {/* main */}
                        <div className="relative min-w-0 flex-1 overflow-hidden p-4 sm:p-5 lg:pr-[316px]">
                            <p className="text-muted-foreground font-mono text-[10px]">NCC/ICT/2026/014</p>
                            <p className="mt-0.5 truncate text-sm font-semibold sm:text-base">Enterprise network infrastructure — 12 council sites</p>

                            <div className="mt-4 grid grid-cols-4 gap-2">
                                {[
                                    ['Eligibility', '72', 'text-status-partial'],
                                    ['Blockers', '3', 'text-status-not-met'],
                                    ['Met', '9/18', 'text-status-met'],
                                    ['Due in', '24d', 'text-foreground'],
                                ].map(([l, v, tone]) => (
                                    <div key={l} className="bg-card rounded-lg border px-2.5 py-2">
                                        <p className="text-muted-foreground text-[10px]">{l}</p>
                                        <p className={cn('text-base font-semibold tabular-nums sm:text-lg', tone)}>{v}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-card mt-3 overflow-hidden rounded-lg border">
                                {rows.map((r, i) => (
                                    <div
                                        key={r.code}
                                        className={cn('flex items-center gap-3 border-t px-3 py-2 first:border-t-0', i === 2 && 'bg-accent/70')}
                                    >
                                        <span className={cn('size-1.5 shrink-0 rounded-full', statusMeta[r.status].dot)} />
                                        <span className="text-muted-foreground w-9 font-mono text-[10px]">{r.code}</span>
                                        <span className="min-w-0 flex-1 truncate text-xs">{r.title}</span>
                                        {r.tag && (
                                            <span
                                                className={cn(
                                                    'hidden rounded px-1.5 py-px text-[9px] font-semibold uppercase lg:inline',
                                                    r.tag === 'Blocker'
                                                        ? 'bg-red-500/10 text-red-600 dark:text-red-300'
                                                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                                                )}
                                            >
                                                {r.tag}
                                            </span>
                                        )}
                                        <StatusBadge status={r.status} className="text-[10px]" />
                                    </div>
                                ))}
                            </div>

                            {/* drawer */}
                            <div className="bg-card absolute inset-y-0 right-0 hidden w-[300px] border-l p-4 shadow-[-24px_0_48px_-24px_rgba(0,0,0,0.25)] lg:block">
                                <p className="text-muted-foreground font-mono text-[10px]">M-03 · Mandatory</p>
                                <p className="mt-1 text-sm font-semibold">Cyber Essentials Plus certificate</p>
                                <StatusBadge status="not_met" className="mt-2" />
                                <div className="mt-3 flex gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 text-[11px] leading-relaxed">
                                    <Sparkles className="text-status-not-met mt-0.5 size-3 shrink-0" />
                                    Certificate on file expired on 31 Oct 2026 — before the deadline.
                                </div>
                                <p className="text-muted-foreground mt-4 flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase">
                                    <Quote className="size-3" /> Tender clause
                                </p>
                                <div className="bg-muted/50 mt-1.5 rounded-lg border p-2.5">
                                    <p className="border-primary/50 border-l-2 pl-2 text-[11px] leading-relaxed">
                                        Bidders must hold a current Cyber Essentials Plus certificate{' '}
                                        <mark className="bg-primary/15 text-foreground rounded-sm px-0.5">valid at the contract start date</mark>.
                                    </p>
                                    <p className="text-muted-foreground mt-2 flex items-center gap-1 text-[10px]">
                                        <FileText className="size-3" /> Invitation to Tender · p. 7 · § 5.1(c)
                                    </p>
                                </div>
                                <p className="text-muted-foreground mt-4 text-[10px] font-semibold tracking-wide uppercase">Remedy</p>
                                <p className="mt-1 text-[11px] leading-relaxed">
                                    Book a reassessment with an IASME certification body. ~10 working days.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
