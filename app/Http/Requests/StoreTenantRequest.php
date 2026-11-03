<?php

namespace App\Http\Requests;

use DateTimeZone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'country' => ['required', 'string', 'size:2'],
            'time_zone' => ['required', 'string', Rule::in(DateTimeZone::listIdentifiers())],
        ];
    }
}
