import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { countryCodes, countryName, timeZones } from '@/lib/places';

export type CompanyData = {
    name: string;
    country: string;
    time_zone: string;
};

interface Props {
    data: CompanyData;
    errors: Partial<Record<keyof CompanyData, string>>;
    onChange: <K extends keyof CompanyData>(key: K, value: CompanyData[K]) => void;
    disabled?: boolean;
}

const selectClass =
    'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

/** Name, country and time zone, used in Settings > Company details. */
export function CompanyFields({ data, errors, onChange, disabled }: Props) {
    const zones = timeZones();

    return (
        <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Company name</Label>
                <Input
                    id="name"
                    className="h-10"
                    value={data.name}
                    onChange={(e) => onChange('name', e.target.value)}
                    placeholder="Acme Facilities Ltd"
                    autoComplete="organization"
                    required
                    disabled={disabled}
                />
                <InputError message={errors.name} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="country">Registered in</Label>
                <select
                    id="country"
                    className={selectClass}
                    value={data.country}
                    onChange={(e) => onChange('country', e.target.value)}
                    disabled={disabled}
                >
                    {countryCodes.map((code) => (
                        <option key={code} value={code}>
                            {countryName(code)}
                        </option>
                    ))}
                </select>
                <InputError message={errors.country} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="time_zone">Time zone</Label>
                <select
                    id="time_zone"
                    className={selectClass}
                    value={data.time_zone}
                    onChange={(e) => onChange('time_zone', e.target.value)}
                    disabled={disabled}
                >
                    {zones.map((zone) => (
                        <option key={zone} value={zone}>
                            {zone.replace(/_/g, ' ')}
                        </option>
                    ))}
                </select>
                <InputError message={errors.time_zone} />
            </div>
            <p className="text-muted-foreground -mt-2 text-xs sm:col-span-2">Tender deadlines and reminders are shown in this time zone.</p>
        </div>
    );
}
