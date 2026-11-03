/** Countries offered when creating a company. UK and EU first (spec: initial market). */
export const countryCodes = ['GB', 'IE', 'FR', 'DE', 'NL', 'BE', 'ES', 'IT', 'PT', 'SE', 'DK', 'PL', 'NG', 'US'];

const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en-GB'], { type: 'region' }) : null;

export function countryName(code: string): string {
    return regionNames?.of(code) ?? code;
}

/** Every IANA time zone the browser knows, with a short fallback list. */
export function timeZones(): string[] {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };

    return intl.supportedValuesOf?.('timeZone') ?? ['Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Africa/Lagos', 'UTC'];
}

export function defaultTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
}
