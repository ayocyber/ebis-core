import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExpiryPill } from '@/components/vault/document-card';
import { useVault } from '@/hooks/use-vault';
import AppLayout from '@/layouts/app-layout';
import { formatDate } from '@/lib/ebis';
import { canEdit } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { CompanyProfile } from '@/types/ebis';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Award,
    BadgeCheck,
    Building2,
    Check,
    HeartHandshake,
    Landmark,
    Loader2,
    Pencil,
    Plus,
    ShieldCheck,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';

const gbp = (n: number, compact = false) =>
    new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 2 : 0,
    }).format(n);

type ProfileProps = SharedData & { profile: CompanyProfile & { version: number } };

export default function CompanyProfilePage() {
    const { role, profile } = usePage<ProfileProps>().props;
    const editable = canEdit(role);
    const { documents, missing } = useVault();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<CompanyProfile>(profile);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const certs = documents.filter((d) => d.category === 'certificate');
    const insuranceDocs = documents.filter((d) => d.category === 'insurance');
    const people = documents.filter((d) => d.category === 'people');

    const years = profile.turnover;
    const avg = years.length ? years.reduce((t, y) => t + y.amount, 0) / years.length : 0;
    const max = Math.max(1, ...years.map((y) => y.amount));
    const growth = years.length > 1 && years[0].amount > 0 ? Math.round(((years.at(-1)!.amount - years[0].amount) / years[0].amount) * 100) : null;

    const checks = [
        !!profile.companyNumber,
        !!profile.vatNumber,
        !!profile.cdpId,
        profile.turnover.length >= 3,
        insuranceDocs.length >= 3,
        certs.length > 0,
        people.length > 0,
        profile.socialValue.length > 0,
        ...missing.map(() => false),
    ];
    const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    const startEditing = () => {
        setDraft(profile);
        setErrors({});
        setEditing(true);
    };

    const save = () => {
        setSaving(true);
        router.patch(
            route('company.update'),
            {
                ...draft,
                turnover: draft.turnover.filter((y) => y.year.trim()),
                insurance: draft.insurance.filter((i) => i.label.trim()),
                socialValue: draft.socialValue.map((v) => v.trim()).filter(Boolean),
            },
            {
                preserveScroll: true,
                onSuccess: () => setEditing(false),
                onError: (e) => setErrors(e),
                onFinish: () => setSaving(false),
            },
        );
    };
    const errorList = Object.values(errors);

    return (
        <AppLayout breadcrumbs={[{ title: 'Company profile', href: '/company' }]}>
            <Head title="Company profile" />

            <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
                {/* Identity */}
                <section className="bg-card animate-fade-up relative overflow-hidden rounded-2xl border p-5 sm:p-7">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_100%_0%,color-mix(in_oklab,var(--glow)_14%,transparent),transparent_70%)]"
                    />
                    <div className="relative flex flex-col gap-5 md:flex-row md:items-start">
                        <span className="from-primary to-brand flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-semibold text-white shadow-lg">
                            {profile.tradingName
                                .split(' ')
                                .map((w) => w[0])
                                .slice(0, 2)
                                .join('')}
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-semibold tracking-tight">{profile.legalName}</h1>
                            </div>
                            <p className="text-muted-foreground text-sm">{profile.sector || (editable ? 'Add your sector below' : '')}</p>
                            {editing ? (
                                <textarea
                                    value={draft.about}
                                    onChange={(e) => setDraft({ ...draft, about: e.target.value })}
                                    rows={2}
                                    aria-label="About"
                                    className="border-input bg-background focus-visible:ring-ring/40 w-full max-w-2xl resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
                                />
                            ) : (
                                <p className="max-w-2xl text-pretty">
                                    {profile.about || <span className="text-muted-foreground">No description yet.</span>}
                                </p>
                            )}
                            {errorList.length > 0 && (
                                <ul role="alert" className="text-status-not-met space-y-0.5 text-sm">
                                    {errorList.map((e) => (
                                        <li key={e}>{e}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
                            {editable &&
                                (editing ? (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={saving}
                                            onClick={() => {
                                                setErrors({});
                                                setEditing(false);
                                            }}
                                        >
                                            <X className="size-4" /> Cancel
                                        </Button>
                                        <Button size="sm" onClick={save} disabled={saving}>
                                            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="outline" size="sm" onClick={startEditing}>
                                        <Pencil className="size-4" /> Edit profile
                                    </Button>
                                ))}
                            <div className="w-48">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Profile complete</span>
                                    <span className="font-semibold tabular-nums">{completeness}%</span>
                                </div>
                                <div className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full">
                                    <div
                                        className="bg-primary h-full rounded-full transition-[width] duration-700"
                                        style={{ width: `${completeness}%` }}
                                    />
                                </div>
                                {missing.length > 0 && (
                                    <Link href={route('vault.index')} className="text-primary mt-1.5 block text-xs hover:underline">
                                        {missing.length} document{missing.length > 1 ? 's' : ''} missing
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Registration */}
                    <Card icon={Building2} title="Registration">
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            {editing ? (
                                <>
                                    <Field label="Legal name" value={draft.legalName} onChange={(v) => setDraft({ ...draft, legalName: v })} />
                                    <Field label="Trading name" value={draft.tradingName} onChange={(v) => setDraft({ ...draft, tradingName: v })} />
                                    <Field
                                        label="Company number"
                                        value={draft.companyNumber}
                                        onChange={(v) => setDraft({ ...draft, companyNumber: v })}
                                    />
                                    <Field
                                        label="Incorporated"
                                        type="date"
                                        value={draft.incorporatedAt ?? ''}
                                        onChange={(v) => setDraft({ ...draft, incorporatedAt: v })}
                                    />
                                    <Field label="Sector" value={draft.sector} onChange={(v) => setDraft({ ...draft, sector: v })} />
                                    <Field
                                        label="Registered office"
                                        value={draft.registeredOffice}
                                        onChange={(v) => setDraft({ ...draft, registeredOffice: v })}
                                    />
                                    <Field label="Website" value={draft.website} onChange={(v) => setDraft({ ...draft, website: v })} />
                                    <Field label="VAT number" value={draft.vatNumber} onChange={(v) => setDraft({ ...draft, vatNumber: v })} />
                                    <Field
                                        label="Central Digital Platform ID"
                                        value={draft.cdpId}
                                        onChange={(v) => setDraft({ ...draft, cdpId: v })}
                                    />
                                </>
                            ) : (
                                <>
                                    <Item label="Company number" value={profile.companyNumber} mono />
                                    <Item
                                        label="Incorporated"
                                        value={
                                            profile.incorporatedAt
                                                ? formatDate(profile.incorporatedAt, { day: 'numeric', month: 'long', year: 'numeric' })
                                                : ''
                                        }
                                    />
                                    <Item label="Registered office" value={profile.registeredOffice} />
                                    <Item label="Website" value={profile.website} />
                                    <Item label="VAT number" value={profile.vatNumber} mono />
                                    <Item label="Central Digital Platform ID" value={profile.cdpId} mono />
                                </>
                            )}
                        </dl>
                    </Card>

                    {/* Financial */}
                    <Card
                        icon={Landmark}
                        title="Financial standing"
                        aside={profile.auditor ? <span className="text-muted-foreground text-xs">Audited by {profile.auditor}</span> : undefined}
                    >
                        {editing ? (
                            <div className="space-y-3">
                                <Field label="Auditor" value={draft.auditor} onChange={(v) => setDraft({ ...draft, auditor: v })} />
                                <RowsEditor
                                    label="Turnover by year (£)"
                                    rows={draft.turnover.map((y) => [y.year, String(y.amount)])}
                                    placeholders={['FY25', '1910000']}
                                    onChange={(rows) =>
                                        setDraft({ ...draft, turnover: rows.map(([year, amount]) => ({ year, amount: Number(amount) || 0 })) })
                                    }
                                />
                            </div>
                        ) : years.length === 0 ? (
                            <EmptyNote text="No turnover figures yet. Buyers check these first, so add your last three years." />
                        ) : (
                            <>
                                <div className="flex items-end gap-6">
                                    <div>
                                        <p className="text-muted-foreground text-xs">{years.length}-year average turnover</p>
                                        <p className="text-2xl font-semibold tracking-tight tabular-nums">{gbp(avg, true)}</p>
                                        {growth !== null && (
                                            <p
                                                className={cn(
                                                    'mt-1 flex items-center gap-1 text-xs font-medium',
                                                    growth >= 0 ? 'text-status-met' : 'text-status-not-met',
                                                )}
                                            >
                                                <TrendingUp className="size-3.5" /> {growth}% since {years[0].year}
                                            </p>
                                        )}
                                    </div>
                                    <div
                                        className="flex h-28 flex-1 items-end justify-end gap-3"
                                        role="img"
                                        aria-label={`Turnover: ${years.map((y) => `${y.year} ${gbp(y.amount, true)}`).join(', ')}`}
                                    >
                                        {years.map((y, i) => (
                                            <div key={y.year} className="flex w-14 flex-col items-center gap-1.5">
                                                <span className="text-xs font-medium tabular-nums">{gbp(y.amount, true)}</span>
                                                <div
                                                    className={cn(
                                                        'w-full rounded-t-[4px] transition-[height] duration-700',
                                                        i === years.length - 1 ? 'bg-primary' : 'bg-primary/35',
                                                    )}
                                                    style={{ height: `${(y.amount / max) * 64}px` }}
                                                />
                                                <span className="text-muted-foreground text-[11px]">{y.year}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-muted-foreground bg-muted/50 mt-4 rounded-lg p-3 text-xs leading-relaxed">
                                    Buyers often ask for turnover of about twice the yearly contract value. On this basis you can comfortably bid for
                                    contracts up to <span className="text-foreground font-medium">{gbp(avg / 2, true)} a year</span> on your own.
                                </p>
                            </>
                        )}
                    </Card>

                    {/* Insurance */}
                    <Card icon={ShieldCheck} title="Insurance">
                        {editing ? (
                            <RowsEditor
                                label="Policy and cover (£)"
                                rows={draft.insurance.map((i) => [i.label, String(i.cover)])}
                                placeholders={['Public liability', '5000000']}
                                onChange={(rows) =>
                                    setDraft({ ...draft, insurance: rows.map(([label, cover]) => ({ label, cover: Number(cover) || 0 })) })
                                }
                            />
                        ) : profile.insurance.length === 0 ? (
                            <EmptyNote text="No insurance cover recorded. Most tenders ask for employer’s, public and professional liability." />
                        ) : (
                            <ul className="divide-y">
                                {profile.insurance.map((ins) => {
                                    const doc = insuranceDocs.find((d) => d.title.toLowerCase().startsWith(ins.label.toLowerCase().slice(0, 8)));
                                    return (
                                        <li key={ins.label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                            <div>
                                                <p className="text-sm font-medium">{ins.label}</p>
                                                <p className="text-muted-foreground text-xs">{doc?.issuer ?? 'No certificate in the vault'}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold tabular-nums">{gbp(ins.cover, true)}</span>
                                                {doc && <ExpiryPill doc={doc} />}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>

                    {/* Certifications */}
                    <Card icon={Award} title="Certifications" aside={<VaultLink />}>
                        {certs.length === 0 && <EmptyNote text="No certificates in the vault yet." />}
                        <ul className="divide-y">
                            {certs.map((c) => (
                                <li key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{c.title}</p>
                                        <p className="text-muted-foreground truncate text-xs">
                                            {[c.issuer, c.reference].filter(Boolean).join(' · ')}
                                        </p>
                                    </div>
                                    <ExpiryPill doc={c} />
                                </li>
                            ))}
                        </ul>
                    </Card>

                    {/* People */}
                    <Card icon={Users} title="People">
                        <div className="grid grid-cols-2 gap-3">
                            {editing ? (
                                <>
                                    <Field
                                        label="Employees"
                                        type="number"
                                        value={String(draft.employees)}
                                        onChange={(v) => setDraft({ ...draft, employees: Number(v) || 0 })}
                                    />
                                    <Field
                                        label="Engineers"
                                        type="number"
                                        value={String(draft.engineers)}
                                        onChange={(v) => setDraft({ ...draft, engineers: Number(v) || 0 })}
                                    />
                                </>
                            ) : (
                                <>
                                    <div className="bg-muted/40 rounded-xl border p-3">
                                        <p className="text-muted-foreground text-xs">Employees</p>
                                        <p className="text-2xl font-semibold tabular-nums">{profile.employees}</p>
                                    </div>
                                    <div className="bg-muted/40 rounded-xl border p-3">
                                        <p className="text-muted-foreground text-xs">Engineers</p>
                                        <p className="text-2xl font-semibold tabular-nums">{profile.engineers}</p>
                                    </div>
                                </>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-4 text-xs font-semibold tracking-wide uppercase">Key personnel</p>
                        <ul className="mt-2 space-y-2">
                            {people.map((p) => (
                                <li key={p.id} className="flex items-center gap-3">
                                    <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                        {p.title
                                            .replace(/^CV — /, '')
                                            .split(' ')
                                            .map((w) => w[0])
                                            .join('')}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">{p.title.replace(/^CV — /, '')}</p>
                                        <p className="text-muted-foreground truncate text-xs">{p.summary}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Card>

                    {/* Social value */}
                    <Card icon={HeartHandshake} title="Social value">
                        {editing ? (
                            <div className="space-y-1.5">
                                <Label htmlFor="f-social" className="text-xs">
                                    One commitment per line
                                </Label>
                                <textarea
                                    id="f-social"
                                    rows={4}
                                    value={draft.socialValue.join('\n')}
                                    onChange={(e) => setDraft({ ...draft, socialValue: e.target.value.split('\n') })}
                                    className="border-input bg-background focus-visible:ring-ring/40 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
                                />
                            </div>
                        ) : profile.socialValue.length === 0 ? (
                            <EmptyNote text="No social value commitments yet." />
                        ) : (
                            <ul className="space-y-2.5">
                                {profile.socialValue.map((s) => (
                                    <li key={s} className="flex gap-2.5 text-sm">
                                        <Check className="text-status-met mt-0.5 size-4 shrink-0" strokeWidth={2.5} /> {s}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="text-muted-foreground bg-muted/50 mt-4 rounded-lg p-3 text-xs leading-relaxed">
                            Social value is usually worth at least 10% of the score in UK public tenders. EBIS uses these commitments as a starting
                            point and tailors them to each buyer.
                        </p>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

function Card({ icon: Icon, title, aside, children }: { icon: typeof Building2; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="bg-card animate-fade-up rounded-2xl border p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-semibold tracking-tight">
                    <Icon className="text-primary size-4" /> {title}
                </h2>
                {aside}
            </div>
            {children}
        </section>
    );
}

function Item({ label, value, mono, verified }: { label: string; value: string; mono?: boolean; verified?: boolean }) {
    return (
        <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className={cn('flex items-center gap-1.5 text-sm font-medium', mono && 'font-mono')}>
                <span className="truncate">{value || '—'}</span>
                {verified && <BadgeCheck className="text-status-met size-3.5 shrink-0" aria-label="Verified" />}
            </dd>
        </div>
    );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
    const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-xs">
                {label}
            </Label>
            <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
        </div>
    );
}

function EmptyNote({ text }: { text: string }) {
    return <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">{text}</p>;
}

/** Edit a short list of name + amount rows (year + turnover, policy + cover). */
function RowsEditor({
    label,
    rows,
    placeholders,
    onChange,
}: {
    label: string;
    rows: [string, string][];
    placeholders: [string, string];
    onChange: (rows: [string, string][]) => void;
}) {
    const set = (i: number, col: 0 | 1, v: string) =>
        onChange(rows.map((r, j): [string, string] => (j !== i ? r : col === 0 ? [v, r[1]] : [r[0], v])));
    return (
        <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-medium">{label}</legend>
            {rows.map((r, i) => (
                <div key={i} className="flex gap-2">
                    <Input
                        value={r[0]}
                        onChange={(e) => set(i, 0, e.target.value)}
                        placeholder={placeholders[0]}
                        className="h-9 min-w-0 flex-1"
                        aria-label={`${label}, row ${i + 1}, name`}
                    />
                    <Input
                        value={r[1]}
                        onChange={(e) => set(i, 1, e.target.value)}
                        placeholder={placeholders[1]}
                        type="number"
                        min={0}
                        className="h-9 w-32"
                        aria-label={`${label}, row ${i + 1}, amount`}
                    />
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-9 shrink-0"
                        aria-label={`Remove row ${i + 1}`}
                        onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    >
                        <X className="size-4" />
                    </Button>
                </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, ['', '']])}>
                <Plus className="size-4" /> Add row
            </Button>
        </fieldset>
    );
}

function VaultLink() {
    return (
        <Link href={route('vault.index')} className="text-primary text-xs font-medium hover:underline">
            Open vault
        </Link>
    );
}
