<?php

namespace Database\Factories;

use App\Models\TutorAvailability;
use App\Models\TutorProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TutorAvailability>
 */
class TutorAvailabilityFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tutor_profile_id' => TutorProfile::factory(),
            'starts_at' => now()->addDays(7)->startOfHour(),
            'ends_at' => now()->addDays(7)->startOfHour()->addHour(),
        ];
    }
}
