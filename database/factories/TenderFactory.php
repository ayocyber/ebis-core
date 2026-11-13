<?php

namespace Database\Factories;

use App\Enums\BuyerType;
use App\Enums\TenderStage;
use App\Models\Tender;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tender>
 */
class TenderFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => 'Network refresh across '.fake()->numberBetween(2, 20).' council sites',
            'reference' => 'NCC/ICT/2026/'.fake()->unique()->numerify('###'),
            'buyer_name' => fake()->city().' County Council',
            'buyer_type' => BuyerType::Local,
            'deadline' => now()->addWeeks(3)->setTime(12, 0),
            'estimated_value' => 1_200_000,
            'stage' => TenderStage::Requirements,
        ];
    }
}
