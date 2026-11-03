<?php

namespace Database\Factories;

use App\Enums\TenantRole;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tenant>
 */
class TenantFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'country' => 'GB',
            'time_zone' => 'Europe/London',
            'data_region' => 'uk',
            'created_by' => User::factory(),
        ];
    }

    /** Create the tenant with this user as Owner (and as their current company). */
    public function ownedBy(User $user): static
    {
        return $this->state(['created_by' => $user->getKey()])
            ->afterCreating(function (Tenant $tenant) use ($user) {
                $tenant->addMember($user, TenantRole::Owner);
                $user->forceFill(['current_tenant_id' => $tenant->getKey()])->save();
            });
    }
}
