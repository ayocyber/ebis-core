<?php

namespace App\Http\Requests\Vault;

use App\Enums\VaultCategory;
use App\Models\VaultDocument;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVaultDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('edit-tenant-data') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:'.VaultDocument::MAX_KB, 'extensions:'.implode(',', VaultDocument::EXTENSIONS)],
            'title' => ['required', 'string', 'min:2', 'max:160'],
            'category' => ['required', Rule::enum(VaultCategory::class)],
            'issuer' => ['nullable', 'string', 'max:160'],
            'reference' => ['nullable', 'string', 'max:120'],
            'issued_at' => ['nullable', 'date', 'before_or_equal:today'],
            // Upload the current version: an expired document can't prove anything.
            'expires_at' => ['nullable', 'date', 'after_or_equal:today'],
            'summary' => ['nullable', 'string', 'max:1000'],
            'fact_keys' => ['nullable', 'array', 'max:10'],
            'fact_keys.*' => ['string', 'max:64', 'regex:/^[a-z0-9][a-z0-9-]*$/'],
            // Rule::exists ignores the tenant scope; VaultUploader re-finds it scoped (404 otherwise).
            'replaces_id' => ['nullable', 'uuid'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'file.max' => 'The file is too large. The limit is 25 MB.',
            'file.extensions' => 'Use a PDF, Word document or image.',
            'expires_at.after_or_equal' => 'This date has passed. Upload the current version.',
        ];
    }
}
