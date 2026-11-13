<?php

namespace Database\Factories;

use App\Enums\VaultCategory;
use App\Models\VaultDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Create inside CurrentTenant::runAs() so tenant_id is filled in. No file is stored.
 *
 * @extends Factory<VaultDocument>
 */
class VaultDocumentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title' => 'ISO 9001',
            'category' => VaultCategory::Certificate,
            'file_name' => 'ISO 9001.pdf',
            'kind' => 'pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 120_000,
            'disk' => 'local',
            'path' => 'tenants/test/vault/'.fake()->uuid().'.pdf',
            'sha256' => hash('sha256', fake()->uuid()),
            'expires_at' => now()->addYear()->toDateString(),
        ];
    }

    public function expiresInDays(int $days): static
    {
        return $this->state(['expires_at' => now()->addDays($days)->toDateString()]);
    }
}
