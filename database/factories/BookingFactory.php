<?php

namespace Database\Factories;

use App\Models\Booking;
use App\Models\TutorAvailability;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Booking>
 */
class BookingFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'student_id' => User::factory(),
            'tutor_profile_id' => null,
            'tutor_availability_id' => TutorAvailability::factory(),
            'starts_at' => null,
            'ends_at' => null,
            'status' => Booking::PENDING,
        ];
    }

    public function configure(): static
    {
        return $this->afterMaking(function (Booking $booking): void {
            $availability = TutorAvailability::query()->findOrFail($booking->tutor_availability_id);
            $booking->tutor_profile_id ??= $availability->tutor_profile_id;
            $booking->starts_at ??= $availability->starts_at;
            $booking->ends_at ??= $availability->ends_at;
        });
    }

    public function forAvailability(TutorAvailability $availability): static
    {
        return $this->state([
            'tutor_profile_id' => $availability->tutor_profile_id,
            'tutor_availability_id' => $availability->getKey(),
            'starts_at' => $availability->starts_at,
            'ends_at' => $availability->ends_at,
        ]);
    }
}
