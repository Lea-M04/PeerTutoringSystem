<?php

namespace Database\Factories;

use App\Models\TutorApplication;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TutorApplication>
 */
class TutorApplicationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'motivation' => fake()->paragraph(),
            'status' => TutorApplication::PENDING,
            'reviewer_id' => null,
            'reviewed_at' => null,
            'rejection_reason' => null,
        ];
    }
}
