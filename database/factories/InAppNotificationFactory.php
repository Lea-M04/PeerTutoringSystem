<?php

namespace Database\Factories;

use App\Models\InAppNotification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InAppNotification>
 */
class InAppNotificationFactory extends Factory
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
            'event_key' => fake()->unique()->bothify('event-########'),
            'type' => 'booking_requested',
            'title' => 'New tutoring request',
            'message' => 'A student requested a tutoring session.',
            'booking_id' => null,
            'tutor_application_id' => null,
            'read_at' => null,
        ];
    }
}
