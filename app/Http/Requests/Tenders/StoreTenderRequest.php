<?php

namespace App\Http\Requests\Tenders;

use App\Enums\BuyerType;
use App\Models\TenderDocument;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** ING-01 (files) and ING-04 (details). */
class StoreTenderRequest extends FormRequest
{
    public const MAX_FILES = 20;

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
            'files' => ['required', 'array', 'min:1', 'max:'.self::MAX_FILES],
            'files.*' => ['required', 'file', 'max:'.TenderDocument::MAX_KB, 'extensions:'.implode(',', TenderDocument::EXTENSIONS)],
            ...self::detailRules(),
            'allow_duplicate' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Shared with editing a tender's details.
     *
     * @return array<string, array<mixed>>
     */
    public static function detailRules(): array
    {
        return [
            'title' => ['required', 'string', 'min:3', 'max:255'],
            'reference' => ['nullable', 'string', 'max:100'],
            'buyer_name' => ['required', 'string', 'min:2', 'max:255'],
            'buyer_type' => ['required', Rule::enum(BuyerType::class)],
            'buyer_location' => ['nullable', 'string', 'max:255'],
            'sector' => ['nullable', 'string', 'max:255'],
            'deadline' => ['required', 'date'],
            'clarification_deadline' => ['nullable', 'date', 'before_or_equal:deadline'],
            'estimated_value' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'lots' => ['nullable', 'integer', 'min:1', 'max:500'],
            'summary' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return self::detailMessages() + [
            'files.required' => 'Add at least one tender document.',
            'files.max' => 'Upload up to '.self::MAX_FILES.' files at a time, or put them in a ZIP.',
            'files.*.max' => 'Each file can be up to 50 MB.',
            'files.*.extensions' => 'Only PDF, Word (DOCX) or ZIP files can be uploaded.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function detailMessages(): array
    {
        return [
            'deadline.required' => 'Add the submission deadline. It is needed before the tender can be checked.',
            'clarification_deadline.before_or_equal' => 'The clarification deadline must be on or before the submission deadline.',
            'buyer_name.required' => 'Add the buyer (the organisation running the tender).',
        ];
    }
}
