import { type CompanyData } from '@/components/company-fields';
import InputError from '@/components/input-error';
import { SetupHeader } from '@/components/onboarding/setup-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { companyProfile } from '@/data/mock-vault';
import { countryCodes, countryName, defaultTimeZone, timeZones } from '@/lib/places';
import { cn } from '@/lib/utils';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Building2, Check, FileSearch, Loader2, LockKeyhole, Search, ShieldCheck, UploadCloud } from 'lucide-react';
import { FormEventHandler, useMemo, useState } from 'react';

const sectors = [
    'IT & digital',
    'Facilities management',
    'Construction',
    'Health & social care',
    'Consultancy',
    'Education & training',
    'Transport & logistics',
    'Other',
];

const sizes = [
    { id: 'micro', label: '1–9', hint: 'Micro' },
    { id: 'small', label: '10–49', hint: 'Small' },
    { id: 'medium', label: '50–249', hint: 'Medium' },
    { id: 'large', label: '250+', hint: 'Large' },
];

/**
 * Setup fields beyond name / country / time zone are frontend-only for now:
 * the server validates the three it stores and ignores the rest.
 */
type SetupData = CompanyData & { company_number: string; sectors: string[]; size: string };

type Lookup = { state: 'idle' } | { state: 'searching' } | { state: 'found'; name: string; detail: string } | { state: 'missing' };

const selectClass =
    'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-11 w-full rounded-lg border px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none';

export default function CreateCompany({ isFirstCompany = true }: { isFirstCompany?: boolean }) {
    const { data, setData, post, processing, errors } = useForm<SetupData>({
        name: '',
        country: 'GB',
        time_zone: defaultTimeZone(),
        company_number: '',
        sectors: [],
        size: '',
    });
    const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
    const zones = useMemo(() => timeZones(), []);
    const isUk = data.country === 'GB';

    // Stand-in for the Companies House API, which arrives with the backend.
    const findCompany = () => {
        const number = data.company_number.trim().toUpperCase();
        if (!/^([0-9]{8}|[A-Z]{2}[0-9]{6})$/.test(number)) {
            setLookup({ state: 'missing' });
            return;
        }
        setLookup({ state: 'searching' });
        window.setTimeout(() => {
            if (number === companyProfile.companyNumber) {
                setData((d) => ({ ...d, name: companyProfile.legalName, sectors: d.sectors.length ? d.sectors : ['IT & digital'] }));
                setLookup({
                    state: 'found',
                    name: companyProfile.legalName,
                    detail: `Active · incorporated ${new Date(companyProfile.incorporatedAt).getFullYear()} · ${companyProfile.registeredOffice}`,
                });
            } else {
                setLookup({ state: 'missing' });
            }
        }, 900);
    };

    const toggleSector = (s: string) => setData('sectors', data.sectors.includes(s) ? data.sectors.filter((x) => x !== s) : [...data.sectors, s]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('onboarding.store'));
    };

    return (
        <div className="bg-background text-foreground min-h-dvh">
            <Head title={isFirstCompany ? 'Set up your company' : 'Add another company'} />
            <SetupHeader current={isFirstCompany ? 1 : 0} />

            <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-8">
                    <div className="animate-fade-up space-y-3">
                        {isFirstCompany ? (
                            <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">Step 1 of 3</p>
                        ) : (
                            <Link
                                href={route('dashboard')}
                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
                            >
                                <ArrowLeft className="size-4" /> Back to dashboard
                            </Link>
                        )}
                        <h1 className="text-gradient text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
                            {isFirstCompany ? 'Tell us about your company' : 'Add another company'}
                        </h1>
                        <p className="text-muted-foreground max-w-2xl text-pretty">
                            The basics EBIS needs to check you against tenders. Tenders, evidence and bids are kept separately for each company, and
                            you will be its Owner.
                        </p>
                    </div>

                    <form
                        onSubmit={submit}
                        className="bg-card animate-fade-up divide-y rounded-2xl border shadow-[0_20px_60px_-40px_var(--glow)] [animation-delay:80ms]"
                    >
                        {/* Identity */}
                        <section className="space-y-5 p-5 sm:p-6" aria-labelledby="identity-title">
                            <SectionTitle id="identity-title" n={1} title="Who you are" />

                            <div className="grid gap-2">
                                <Label htmlFor="country">Registered in</Label>
                                <select
                                    id="country"
                                    className={selectClass}
                                    value={data.country}
                                    onChange={(e) => {
                                        setData('country', e.target.value);
                                        setLookup({ state: 'idle' });
                                    }}
                                >
                                    {countryCodes.map((code) => (
                                        <option key={code} value={code}>
                                            {countryName(code)}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.country} />
                            </div>

                            {isUk && (
                                <div className="grid gap-2">
                                    <Label htmlFor="company_number">
                                        Companies House number <span className="text-muted-foreground font-normal">(optional)</span>
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="company_number"
                                            value={data.company_number}
                                            onChange={(e) => {
                                                setData('company_number', e.target.value);
                                                if (lookup.state !== 'idle') setLookup({ state: 'idle' });
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    findCompany();
                                                }
                                            }}
                                            placeholder="e.g. 08812345"
                                            className="h-11 rounded-lg font-mono tracking-wider"
                                            inputMode="text"
                                            maxLength={8}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-11 rounded-lg"
                                            onClick={findCompany}
                                            disabled={!data.company_number.trim() || lookup.state === 'searching'}
                                        >
                                            {lookup.state === 'searching' ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Search className="size-4" />
                                            )}
                                            Find
                                        </Button>
                                    </div>
                                    {lookup.state === 'found' ? (
                                        <div className="border-status-met/30 bg-status-met/[0.06] animate-fade-up flex items-start gap-3 rounded-lg border p-3">
                                            <span className="bg-status-met/15 text-status-met flex size-8 shrink-0 items-center justify-center rounded-lg">
                                                <Check className="size-4" strokeWidth={3} />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium">{lookup.name}</p>
                                                <p className="text-muted-foreground text-xs">{lookup.detail}</p>
                                            </div>
                                        </div>
                                    ) : lookup.state === 'missing' ? (
                                        <p className="text-status-partial text-xs" role="status">
                                            We couldn’t find that number. Check it, or just enter your company name below.
                                        </p>
                                    ) : (
                                        <p className="text-muted-foreground text-xs">
                                            We’ll fill in your name and registered details from Companies House.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="name">Company name</Label>
                                <Input
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="Acme Facilities Ltd"
                                    autoComplete="organization"
                                    className="h-11 rounded-lg"
                                    required
                                />
                                <InputError message={errors.name} />
                            </div>
                        </section>

                        {/* Work */}
                        <section className="space-y-5 p-5 sm:p-6" aria-labelledby="work-title">
                            <SectionTitle id="work-title" n={2} title="What you do" hint="Helps EBIS spot tenders that fit you." />

                            <fieldset className="grid gap-2">
                                <legend className="mb-2 text-sm font-medium">Sectors you bid in</legend>
                                <div className="flex flex-wrap gap-2">
                                    {sectors.map((s) => {
                                        const on = data.sectors.includes(s);
                                        return (
                                            <button
                                                key={s}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => toggleSector(s)}
                                                className={cn(
                                                    'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all',
                                                    on
                                                        ? 'border-primary bg-primary/10 text-foreground'
                                                        : 'text-muted-foreground hover:border-primary/40 hover:text-foreground',
                                                )}
                                            >
                                                {on && <Check className="text-primary size-3.5" strokeWidth={3} />}
                                                {s}
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>

                            <fieldset className="grid gap-2">
                                <legend className="mb-2 text-sm font-medium">Number of employees</legend>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {sizes.map((s) => {
                                        const on = data.size === s.id;
                                        return (
                                            <button
                                                key={s.id}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => setData('size', on ? '' : s.id)}
                                                className={cn(
                                                    'rounded-xl border px-3 py-2.5 text-left transition-all',
                                                    on ? 'border-primary bg-primary/10 ring-primary/20 ring-2' : 'hover:border-primary/40',
                                                )}
                                            >
                                                <span className="block text-sm font-semibold tabular-nums">{s.label}</span>
                                                <span className="text-muted-foreground text-xs">{s.hint}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        </section>

                        {/* Deadlines */}
                        <section className="space-y-5 p-5 sm:p-6" aria-labelledby="time-title">
                            <SectionTitle id="time-title" n={3} title="Deadlines" />
                            <div className="grid gap-2">
                                <Label htmlFor="time_zone">Time zone</Label>
                                <select
                                    id="time_zone"
                                    className={selectClass}
                                    value={data.time_zone}
                                    onChange={(e) => setData('time_zone', e.target.value)}
                                >
                                    {zones.map((zone) => (
                                        <option key={zone} value={zone}>
                                            {zone.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-muted-foreground text-xs">Tender deadlines and reminders are shown in this time zone.</p>
                                <InputError message={errors.time_zone} />
                            </div>
                        </section>

                        <div className="flex flex-col-reverse items-stretch gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                            <p className="text-muted-foreground text-xs">You can change all of this later in Settings.</p>
                            <Button
                                type="submit"
                                className="h-11 rounded-lg px-6 shadow-[0_10px_28px_-12px_var(--glow)]"
                                disabled={processing || !data.name.trim()}
                            >
                                {processing && <Loader2 className="size-4 animate-spin" />}
                                {isFirstCompany ? 'Continue to documents' : 'Create company'}
                                {!processing && <ArrowRight className="size-4" />}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Sidebar */}
                <aside className="animate-fade-up space-y-4 [animation-delay:160ms] lg:sticky lg:top-24 lg:self-start">
                    <div className="bg-card rounded-2xl border p-5">
                        <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                            {isFirstCompany ? 'Setup takes about 5 minutes' : 'What you get'}
                        </p>
                        <ol className="mt-4 space-y-4">
                            <NextStep icon={Building2} title="Your company" text="Name, sector and size." active={isFirstCompany} />
                            <NextStep
                                icon={UploadCloud}
                                title="Your documents"
                                text="Drop in certificates, insurance and accounts. EBIS reads them once and reuses them for every bid."
                            />
                            <NextStep
                                icon={FileSearch}
                                title="Your first tender"
                                text="Upload a tender pack and see straight away whether you can bid."
                            />
                        </ol>
                    </div>

                    <div className="bg-muted/50 space-y-2 rounded-2xl p-5">
                        <p className="flex items-center gap-2 text-sm font-medium">
                            <LockKeyhole className="text-primary size-4" /> Kept private to your company
                        </p>
                        <p className="text-muted-foreground text-xs leading-relaxed">Only people you invite can see your documents and bids.</p>
                    </div>

                    {isFirstCompany && (
                        <p className="text-muted-foreground flex items-start gap-2 px-1 text-xs leading-relaxed">
                            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                            Invited by a colleague? Open the link in their email instead, so you join their company.
                        </p>
                    )}
                </aside>
            </main>
        </div>
    );
}

function SectionTitle({ id, n, title, hint }: { id: string; n: number; title: string; hint?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <h2 id={id} className="flex items-center gap-2.5 font-semibold tracking-tight">
                <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-md text-xs tabular-nums">{n}</span>
                {title}
            </h2>
            {hint && <p className="text-muted-foreground hidden text-xs sm:block">{hint}</p>}
        </div>
    );
}

function NextStep({ icon: Icon, title, text, active }: { icon: typeof Building2; title: string; text: string; active?: boolean }) {
    return (
        <li className="flex gap-3">
            <span
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl',
                    active ? 'bg-primary text-primary-foreground' : 'bg-primary/8 text-primary dark:bg-primary/15',
                )}
            >
                <Icon className="size-4" />
            </span>
            <div>
                <p className={cn('text-sm font-medium', active && 'text-foreground')}>{title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{text}</p>
            </div>
        </li>
    );
}
