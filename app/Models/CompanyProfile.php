<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use App\Support\Tenancy\CurrentTenant;
use Carbon\Carbon;
use Database\Factories\CompanyProfileFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * PRF-01: the company's core facts. One per company, versioned: every save bumps
 * `version` and keeps a snapshot in company_profile_versions, so an assessment can
 * record exactly which profile it used and later edits never change it.
 *
 * @property string $id
 * @property string $tenant_id
 * @property int $version
 * @property string $legal_name
 * @property string $trading_name
 * @property string $company_number
 * @property Carbon|null $incorporated_at
 * @property string $registered_office
 * @property string $vat_number
 * @property string $cdp_id
 * @property string $website
 * @property string $sector
 * @property int $employees
 * @property int $engineers
 * @property list<array{year: string, amount: int}> $turnover
 * @property string $auditor
 * @property list<array{label: string, cover: int}> $insurance
 * @property list<string> $social_value
 * @property string|null $about
 * @property int|null $updated_by
 * @property array{found: bool, checkedAt: string, number: string, name?: string, status?: string, incorporatedOn?: string|null, address?: string, nameMatches?: bool, dateMatches?: bool, active?: bool}|null $companies_house Last Companies House check
 */
class CompanyProfile extends Model
{
    /** @use HasFactory<CompanyProfileFactory> */
    use BelongsToTenant, HasFactory, HasUuids;

    /** Fields people can edit. Everything else is managed by the app. */
    public const EDITABLE = [
        'legal_name', 'trading_name', 'company_number', 'incorporated_at', 'registered_office', 'vat_number',
        'cdp_id', 'website', 'sector', 'employees', 'engineers', 'turnover', 'auditor', 'insurance',
        'social_value', 'about',
    ];

    /** Plain-English names for the activity log. */
    public const LABELS = [
        'legal_name' => 'Legal name', 'trading_name' => 'Trading name', 'company_number' => 'Company number',
        'incorporated_at' => 'Incorporated', 'registered_office' => 'Registered office', 'vat_number' => 'VAT number',
        'cdp_id' => 'Central Digital Platform ID', 'website' => 'Website', 'sector' => 'Sector',
        'employees' => 'Employees', 'engineers' => 'Engineers', 'turnover' => 'Turnover', 'auditor' => 'Auditor',
        'insurance' => 'Insurance', 'social_value' => 'Social value', 'about' => 'About',
    ];

    protected $fillable = [...self::EDITABLE, 'version', 'updated_by'];

    /** Same defaults as the table, so a freshly created profile has them without a reload. */
    protected $attributes = [
        'version' => 1,
        'legal_name' => '', 'trading_name' => '', 'company_number' => '', 'registered_office' => '',
        'vat_number' => '', 'cdp_id' => '', 'website' => '', 'sector' => '', 'auditor' => '',
        'employees' => 0,
        'engineers' => 0,
        'turnover' => '[]',
        'insurance' => '[]',
        'social_value' => '[]',
    ];

    protected function casts(): array
    {
        return [
            'incorporated_at' => 'date',
            'employees' => 'integer',
            'engineers' => 'integer',
            'version' => 'integer',
            'turnover' => 'array',
            'insurance' => 'array',
            'social_value' => 'array',
            'companies_house' => 'array',
        ];
    }

    /** The current company's profile, started from the company name the first time. */
    public static function current(): self
    {
        $tenant = app(CurrentTenant::class)->require();

        return self::firstOrCreate([], ['legal_name' => $tenant->name, 'trading_name' => $tenant->name]);
    }

    /**
     * Save edits as a new version. Returns the fields that changed (old → new) for the log.
     *
     * @param  array<string, mixed>  $changes
     * @return array<string, array{0: mixed, 1: mixed}>
     */
    public function saveVersion(array $changes, ?User $by): array
    {
        $this->fill($changes);
        $diff = [];
        foreach (array_keys($this->getDirty()) as $field) {
            $diff[$field] = [$this->getOriginal($field), $this->getAttribute($field)];
        }
        if ($diff === []) {
            return [];
        }

        DB::transaction(function () use ($by) {
            $this->version++;
            $this->updated_by = $by?->getKey();
            $this->save();

            DB::table('company_profile_versions')->insert([
                'tenant_id' => $this->tenant_id,
                'version' => $this->version,
                'data' => json_encode($this->only(self::EDITABLE), JSON_THROW_ON_ERROR),
                'created_by' => $by?->getKey(),
                'created_at' => now(),
            ]);
        });

        return $diff;
    }

    /**
     * Shape of `CompanyProfile` in resources/js/types/ebis.ts.
     *
     * @return array<string, mixed>
     */
    public function toFrontend(): array
    {
        return [
            'legalName' => $this->legal_name,
            'tradingName' => $this->trading_name,
            'companyNumber' => $this->company_number,
            'incorporatedAt' => $this->incorporated_at?->toDateString(),
            'registeredOffice' => $this->registered_office,
            'vatNumber' => $this->vat_number,
            'cdpId' => $this->cdp_id,
            'website' => $this->website,
            'sector' => $this->sector,
            'employees' => $this->employees,
            'engineers' => $this->engineers,
            'turnover' => $this->turnover,
            'auditor' => $this->auditor,
            'insurance' => $this->insurance,
            'socialValue' => $this->social_value,
            'about' => $this->about ?? '',
            'version' => $this->version,
            // Last check against the Companies House register, if any.
            'companiesHouse' => $this->companies_house,
        ];
    }
}
