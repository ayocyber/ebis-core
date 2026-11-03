import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DocumentCard } from '@/components/vault/document-card';
import { DocumentDrawer } from '@/components/vault/document-drawer';
import { ExpiryTimeline } from '@/components/vault/expiry-timeline';
import { UploadDialog, type UploadTarget } from '@/components/vault/upload-dialog';
import { useVault } from '@/hooks/use-vault';
import AppLayout from '@/layouts/app-layout';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { expiryState, usageFor, vaultCategoryMeta, vaultCategoryOrder } from '@/lib/vault';
import { type SharedData } from '@/types';
import type { VaultCategory } from '@/types/ebis';
import { Head, Link, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, CalendarClock, FileQuestion, FolderLock, Plus, Search, SearchX, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';

const urgency = { expired: 0, expiring: 1, renew_soon: 2, valid: 3, no_expiry: 4 } as const;

export default function Vault() {
    const { role } = usePage<SharedData>().props;
    const editable = canEdit(role);
    const { documents, missing } = useVault();

    const [category, setCategory] = useState<VaultCategory | 'all'>('all');
    const [query, setQuery] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [upload, setUpload] = useState<{ open: boolean; target: UploadTarget }>({ open: false, target: {} });

    const stats = useMemo(() => {
        const states = documents.map((d) => ({ d, ...expiryState(d) }));
        const expired = states.filter((s) => s.state === 'expired');
        return {
            expired: expired.length,
            expiring: states.filter((s) => s.state === 'expiring').length,
            blocking: expired.filter((s) => usageFor(s.d.factIds).length > 0),
        };
    }, [documents]);

    const q = query.trim().toLowerCase();
    const visible = documents
        .filter((d) => category === 'all' || d.category === category)
        .filter((d) => !q || `${d.title} ${d.issuer ?? ''} ${d.reference ?? ''} ${d.summary}`.toLowerCase().includes(q))
        .sort((a, b) => urgency[expiryState(a).state] - urgency[expiryState(b).state] || a.title.localeCompare(b.title));

    const openDoc = (id: string) => {
        setOpenId(id);
        setDrawerOpen(true);
    };
    const startUpload = (target: UploadTarget = {}) => setUpload({ open: true, target });
    const current = documents.find((d) => d.id === openId) ?? null;

    return (
        <AppLayout breadcrumbs={[{ title: 'Evidence vault', href: '/vault' }]}>
            <Head title="Evidence vault" />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                <div className="animate-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                            <FolderLock className="text-primary size-6" /> Evidence vault
                        </h1>
                        <p className="text-muted-foreground max-w-xl text-sm">
                            Every certificate, policy and case study EBIS uses to check eligibility and back up claims in your bids.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={route('company.profile')}>Company profile</Link>
                        </Button>
                        {editable && (
                            <Button onClick={() => startUpload()} className="shadow-[0_10px_28px_-14px_var(--glow)]">
                                <Upload className="size-4" /> Upload
                            </Button>
                        )}
                    </div>
                </div>

                {stats.blocking.length > 0 && (
                    <div className="border-status-not-met/30 bg-status-not-met/5 animate-fade-up flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
                        <AlertTriangle className="text-status-not-met size-5 shrink-0" />
                        <div className="min-w-0 flex-1 text-sm">
                            <p className="font-semibold">
                                {stats.blocking.length} expired document{stats.blocking.length > 1 ? 's are' : ' is'} hurting live bids
                            </p>
                            <p className="text-muted-foreground">
                                {stats.blocking.map((s) => s.d.title).join(', ')}. Upload the renewal and EBIS re-checks every tender that uses it.
                            </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openDoc(stats.blocking[0].d.id)}>
                            Fix now <ArrowRight className="size-4" />
                        </Button>
                    </div>
                )}

                {/* Stats */}
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Vault summary">
                    <Stat
                        label="Documents"
                        value={documents.length}
                        hint={`${vaultCategoryOrder.filter((c) => documents.some((d) => d.category === c)).length} types`}
                    />
                    <Stat label="Expired" value={stats.expired} hint="Renew before your next bid" tone={stats.expired ? 'danger' : 'ok'} />
                    <Stat label="Expiring in 30 days" value={stats.expiring} hint="Book renewals now" tone={stats.expiring ? 'warn' : 'ok'} />
                    <Stat label="Missing" value={missing.length} hint="Tenders ask for these" tone={missing.length ? 'warn' : 'ok'} />
                </section>

                {/* Timeline */}
                <section className="bg-card rounded-2xl border p-4 sm:p-6">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <h2 className="flex items-center gap-2 font-semibold tracking-tight">
                                <CalendarClock className="text-primary size-4" /> Renewals in the next 12 months
                            </h2>
                            <p className="text-muted-foreground text-sm">Click a document to see where it’s used.</p>
                        </div>
                    </div>
                    <ExpiryTimeline documents={documents} onOpen={openDoc} />
                </section>

                {/* Missing */}
                {missing.length > 0 && (
                    <section aria-labelledby="missing-title" className="space-y-3">
                        <h2 id="missing-title" className="flex items-center gap-2 font-semibold tracking-tight">
                            <FileQuestion className="text-status-partial size-4" /> Missing from your vault
                        </h2>
                        <div className="grid gap-3 md:grid-cols-3">
                            {missing.map((m) => (
                                <div key={m.id} className="border-status-partial/40 flex flex-col gap-3 rounded-xl border border-dashed p-4">
                                    <div>
                                        <p className="font-medium">{m.title}</p>
                                        <p className="text-muted-foreground mt-1 text-sm">{m.why}</p>
                                    </div>
                                    {editable && (
                                        <Button size="sm" variant="outline" className="mt-auto w-fit" onClick={() => startUpload({ missing: m })}>
                                            <Plus className="size-4" /> Add it
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Library */}
                <section className="space-y-4" aria-labelledby="library-title">
                    <h2 id="library-title" className="sr-only">
                        Documents
                    </h2>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div role="tablist" aria-label="Document type" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                            {(['all', ...vaultCategoryOrder] as const).map((c) => {
                                const n = c === 'all' ? documents.length : documents.filter((d) => d.category === c).length;
                                const Icon = c === 'all' ? FolderLock : vaultCategoryMeta[c].icon;
                                return (
                                    <button
                                        key={c}
                                        role="tab"
                                        aria-selected={category === c}
                                        onClick={() => setCategory(c)}
                                        className={cn(
                                            'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                                            category === c
                                                ? 'bg-foreground text-background border-transparent'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                                        )}
                                    >
                                        <Icon className="size-3.5" />
                                        {c === 'all' ? 'All' : vaultCategoryMeta[c].plural}
                                        <span className="tabular-nums opacity-70">{n}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="relative w-full lg:w-72">
                            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search title, issuer or number"
                                className="h-9 pl-8"
                            />
                        </div>
                    </div>

                    {visible.length ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {visible.map((d, i) => (
                                <DocumentCard
                                    key={d.id}
                                    doc={d}
                                    onOpen={() => openDoc(d.id)}
                                    style={{ animationDelay: `${Math.min(i, 9) * 35}ms` }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
                            <SearchX className="text-muted-foreground size-8" />
                            <p className="font-medium">No documents match.</p>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setQuery('');
                                    setCategory('all');
                                }}
                            >
                                Clear filters
                            </Button>
                        </div>
                    )}
                </section>
            </div>

            <DocumentDrawer
                doc={current}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                canEdit={editable}
                onReplace={(doc) => {
                    setDrawerOpen(false);
                    startUpload({ replace: doc });
                }}
            />
            <UploadDialog open={upload.open} onOpenChange={(o) => setUpload((u) => ({ ...u, open: o }))} target={upload.target} />
        </AppLayout>
    );
}

function Stat({ label, value, hint, tone = 'neutral' }: { label: string; value: number; hint: string; tone?: 'danger' | 'warn' | 'ok' | 'neutral' }) {
    return (
        <div className="bg-card rounded-xl border p-4">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                {tone !== 'neutral' && (
                    <span
                        className={cn(
                            'size-2 rounded-full',
                            tone === 'danger' && 'bg-status-not-met',
                            tone === 'warn' && 'bg-status-partial',
                            tone === 'ok' && 'bg-status-met',
                        )}
                    />
                )}
                {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
            <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        </div>
    );
}
