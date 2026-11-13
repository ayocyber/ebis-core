<?php

namespace App\Http\Requests\Tenders;

use App\Enums\RequirementCategory;
use App\Enums\RequirementTopic;
use App\Enums\VaultCategory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Adding or editing a requirement (TUN-03), including how it is checked (ELG-01). */
class RequirementRequest extends FormRequest
{
    public const CHECK_TYPES = ['turnover_min', 'insurance_min', 'certification', 'years_trading', 'vault_documents', 'judgement'];

    public function authorize(): bool
    {
        return Gate::allows('edit-tenant-data');
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:3', 'max:255'],
            'text' => ['required', 'string', 'max:4000'],
            'category' => ['required', Rule::enum(RequirementCategory::class)],
            'topic' => ['required', Rule::enum(RequirementTopic::class)],
            'weight' => ['nullable', 'integer', 'min:0', 'max:100'],
            'document_id' => ['nullable', 'uuid'],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'section' => ['nullable', 'string', 'max:100'],
            'quote' => ['nullable', 'string', 'max:4000'],
            'check' => ['nullable', 'array'],
            'check.type' => ['required_with:check', Rule::in(self::CHECK_TYPES)],
            'check.amount' => ['required_if:check.type,turnover_min,insurance_min', 'nullable', 'integer', 'min:1', 'max:100000000000'],
            'check.years' => ['required_if:check.type,years_trading', 'nullable', 'integer', 'min:1', 'max:50'],
            'check.kind' => ['required_if:check.type,insurance_min', 'nullable', Rule::in(['public', 'employers', 'professional'])],
            'check.name' => ['required_if:check.type,certification', 'nullable', 'string', 'max:100'],
            'check.category' => ['required_if:check.type,vault_documents', 'nullable', Rule::enum(VaultCategory::class)],
            'check.count' => ['nullable', 'integer', 'min:1', 'max:20'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'check.amount.required_if' => 'Add the amount to check against.',
            'check.years.required_if' => 'Add how many years of trading are needed.',
            'check.kind.required_if' => 'Choose which insurance this is.',
            'check.name.required_if' => 'Name the certificate, e.g. ISO 9001.',
            'check.category.required_if' => 'Choose which kind of vault document proves it.',
        ];
    }

    /**
     * Validated data in model columns. A "judgement" check is stored as no rule:
     * the user decides the status during the eligibility check.
     *
     * @return array<string, mixed>
     */
    public function toColumns(): array
    {
        $data = $this->safe()->except('check');
        $check = $this->validated('check');

        if (is_array($check) && ($check['type'] ?? 'judgement') !== 'judgement') {
            $keep = match ($check['type']) {
                'turnover_min' => ['amount', 'years'],
                'insurance_min' => ['kind', 'amount'],
                'certification' => ['name'],
                'years_trading' => ['years'],
                'vault_documents' => ['category', 'count'],
                default => [],
            };
            $rule = ['type' => $check['type']];
            foreach ($keep as $k) {
                if (isset($check[$k]) && $check[$k] !== '') {
                    $rule[$k] = is_numeric($check[$k]) ? (int) $check[$k] : $check[$k];
                }
            }
            $data['check_rule'] = $rule;
        } else {
            $data['check_rule'] = null;
        }

        if (($data['category'] ?? null) !== RequirementCategory::Scored->value) {
            $data['weight'] = null;
        }

        return $data;
    }
}
