<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * The UK Companies House public register (free). Needs an API key from
 * https://developer.company-information.service.gov.uk, set as COMPANIES_HOUSE_API_KEY.
 */
class CompaniesHouse
{
    private const BASE = 'https://api.company-information.service.gov.uk';

    public static function enabled(): bool
    {
        return (string) config('services.companies_house.key') !== '';
    }

    /**
     * The register's entry for a company number, or null when there is none.
     *
     * @return array{number: string, name: string, status: string, incorporatedOn: ?string, address: string}|null
     *
     * @throws RuntimeException when the register can't be reached
     */
    public function company(string $number): ?array
    {
        $number = strtoupper((string) preg_replace('/\s+/', '', $number));
        // Companies House numbers are 8 characters; short English numbers are padded with zeros.
        if (preg_match('/^\d{1,7}$/', $number)) {
            $number = str_pad($number, 8, '0', STR_PAD_LEFT);
        }

        $response = Http::withBasicAuth((string) config('services.companies_house.key'), '')
            ->acceptJson()
            ->timeout(10)
            ->get(self::BASE.'/company/'.rawurlencode($number));

        if ($response->status() === 404) {
            return null;
        }
        if (! $response->successful()) {
            throw new RuntimeException("Companies House answered {$response->status()}.");
        }

        $a = (array) $response->json('registered_office_address', []);

        return [
            'number' => (string) $response->json('company_number', $number),
            // e.g. "BLUEWAVE NETWORKS LIMITED"
            'name' => (string) $response->json('company_name', ''),
            'status' => (string) $response->json('company_status', 'unknown'),
            'incorporatedOn' => $response->json('date_of_creation'),
            'address' => implode(', ', array_filter([
                $a['address_line_1'] ?? null, $a['address_line_2'] ?? null, $a['locality'] ?? null, $a['postal_code'] ?? null,
            ])),
        ];
    }

    /** "Bluewave Networks Ltd" and "BLUEWAVE NETWORKS LIMITED" are the same name. */
    public static function sameName(?string $a, ?string $b): bool
    {
        $core = fn (?string $s) => trim((string) preg_replace(
            ['/[^a-z0-9]+/', '/\b(ltd|limited|plc|llp|lp)\b/', '/\s+/'],
            [' ', '', ' '],
            strtolower((string) $s),
        ));

        return $core($a) !== '' && $core($a) === $core($b);
    }
}
