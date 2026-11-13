<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Accepts the frontend's camelCase CompanyProfile fields; validated() returns
 * database column names.
 */
class UpdateCompanyProfileRequest extends FormRequest
{
    private const FIELDS = [
        'legalName' => 'legal_name', 'tradingName' => 'trading_name', 'companyNumber' => 'company_number',
        'incorporatedAt' => 'incorporated_at', 'registeredOffice' => 'registered_office', 'vatNumber' => 'vat_number',
        'cdpId' => 'cdp_id', 'website' => 'website', 'sector' => 'sector', 'employees' => 'employees',
        'engineers' => 'engineers', 'turnover' => 'turnover', 'auditor' => 'auditor', 'insurance' => 'insurance',
        'socialValue' => 'social_value', 'about' => 'about',
    ];

    public function authorize(): bool
    {
        return $this->user()?->can('edit-tenant-data') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $text = ['sometimes', 'nullable', 'string', 'max:255'];

        return [
            'legalName' => ['sometimes', 'required', 'string', 'max:160'],
            'tradingName' => $text,
            'companyNumber' => ['sometimes', 'nullable', 'string', 'max:16'],
            'incorporatedAt' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'registeredOffice' => $text,
            'vatNumber' => ['sometimes', 'nullable', 'string', 'max:32'],
            'cdpId' => ['sometimes', 'nullable', 'string', 'max:64'],
            'website' => $text,
            'sector' => $text,
            'employees' => ['sometimes', 'integer', 'min:0', 'max:1000000'],
            'engineers' => ['sometimes', 'integer', 'min:0', 'max:1000000', 'lte:employees'],
            'turnover' => ['sometimes', 'array', 'max:10'],
            'turnover.*.year' => ['required', 'string', 'max:16'],
            'turnover.*.amount' => ['required', 'integer', 'min:0'],
            'auditor' => $text,
            'insurance' => ['sometimes', 'array', 'max:20'],
            'insurance.*.label' => ['required', 'string', 'max:120'],
            'insurance.*.cover' => ['required', 'integer', 'min:0'],
            'socialValue' => ['sometimes', 'array', 'max:20'],
            'socialValue.*' => ['string', 'max:255'],
            'about' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['engineers.lte' => 'Engineers can’t be more than employees.'];
    }

    /**
     * Validated input with database column names. Empty text becomes ''.
     *
     * @return array<string, mixed>
     */
    public function columns(): array
    {
        $out = [];
        foreach ($this->validated() as $field => $value) {
            $column = self::FIELDS[$field];
            $out[$column] = $value ?? (in_array($column, ['incorporated_at', 'about'], true) ? null : '');
        }

        return $out;
    }
}
