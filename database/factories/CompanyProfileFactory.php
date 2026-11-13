<?php

namespace Database\Factories;

use App\Models\CompanyProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CompanyProfile>
 */
class CompanyProfileFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->company().' Ltd';

        return [
            'legal_name' => $name,
            'trading_name' => $name,
            'company_number' => (string) fake()->numberBetween(10_000_000, 15_999_999),
            'employees' => 20,
            'engineers' => 12,
            'turnover' => [['year' => 'FY25', 'amount' => 1_500_000]],
            'insurance' => [],
            'social_value' => [],
        ];
    }
}
