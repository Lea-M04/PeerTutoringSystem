<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\TutorAvailability;
use App\Models\TutorProfile;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BookingFoundationTest extends TestCase
{
    use RefreshDatabase;

    private function availabilityFor(User $tutor): TutorAvailability
    {
        $profile = $tutor->tutorProfile()->create();

        return $profile->availabilities()->create([
            'starts_at' => '2030-02-10T09:00:00Z',
            'ends_at' => '2030-02-10T10:00:00Z',
        ]);
    }

    private function createBooking(User $student, TutorProfile $profile, TutorAvailability $availability): Booking
    {
        return Booking::factory()->forAvailability($availability)->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $profile->getKey(),
        ])->refresh();
    }

    public function test_default_factory_creates_a_booking_linked_to_its_source_tutors_profile(): void
    {
        $booking = Booking::factory()->create();

        $this->assertTrue($booking->availability->tutorProfile->is($booking->tutorProfile));
        $this->assertTrue($booking->student->exists);
        $this->assertSame(
            $booking->availability->starts_at->utc()->format('Y-m-d\TH:i:s.u\Z'),
            $booking->starts_at->utc()->format('Y-m-d\TH:i:s.u\Z'),
        );
        $this->assertSame(
            $booking->availability->ends_at->utc()->format('Y-m-d\TH:i:s.u\Z'),
            $booking->ends_at->utc()->format('Y-m-d\TH:i:s.u\Z'),
        );
    }

    public function test_booking_persists_its_participants_source_interval_and_time_snapshots(): void
    {
        $student = User::factory()->create();
        $tutor = User::factory()->create();
        $availability = $this->availabilityFor($tutor);
        $booking = $this->createBooking($student, $tutor->tutorProfile, $availability)->fresh();

        $this->assertSame(Booking::PENDING, $booking->status);
        $this->assertSame('2030-02-10T09:00:00.000000Z', $booking->starts_at->utc()->format('Y-m-d\TH:i:s.u\Z'));
        $this->assertSame('2030-02-10T10:00:00.000000Z', $booking->ends_at->utc()->format('Y-m-d\TH:i:s.u\Z'));
        $this->assertTrue($booking->student->is($student));
        $this->assertTrue($booking->tutorProfile->is($tutor->tutorProfile));
        $this->assertTrue($booking->availability->is($availability));
        $this->assertTrue($availability->hasReservingBookings());
        $this->assertModelExists($booking);
    }

    public function test_booking_time_snapshots_do_not_change_when_source_availability_is_edited(): void
    {
        $student = User::factory()->create();
        $tutor = User::factory()->create();
        $availability = $this->availabilityFor($tutor);
        $booking = $this->createBooking($student, $tutor->tutorProfile, $availability);

        $availability->update([
            'starts_at' => '2030-02-10T11:00:00Z',
            'ends_at' => '2030-02-10T12:00:00Z',
        ]);

        $this->assertSame('2030-02-10T09:00:00.000000Z', $booking->fresh()->starts_at->utc()->format('Y-m-d\TH:i:s.u\Z'));
        $this->assertSame('2030-02-10T10:00:00.000000Z', $booking->fresh()->ends_at->utc()->format('Y-m-d\TH:i:s.u\Z'));
    }

    public function test_only_pending_and_accepted_bookings_reserve_an_availability_interval(): void
    {
        $student = User::factory()->create();
        $tutor = User::factory()->create();
        $availability = $this->availabilityFor($tutor);
        $booking = $this->createBooking($student, $tutor->tutorProfile, $availability);

        $this->assertTrue($booking->reservesAvailability());
        $this->assertTrue($availability->hasReservingBookings());

        $booking->forceFill(['status' => Booking::ACCEPTED])->save();
        $this->assertTrue($booking->fresh()->reservesAvailability());
        $this->assertTrue($availability->fresh()->hasReservingBookings());

        $booking->forceFill(['status' => Booking::REJECTED])->save();
        $this->assertFalse($booking->fresh()->reservesAvailability());
        $this->assertFalse($availability->fresh()->hasReservingBookings());

        foreach ([Booking::CANCELLED, Booking::COMPLETED] as $releasedStatus) {
            $booking->forceFill(['status' => $releasedStatus])->save();
            $this->assertFalse($booking->fresh()->reservesAvailability());
        }
    }

    public function test_database_prevents_duplicate_pending_or_accepted_reservations_but_allows_rebooking_after_release(): void
    {
        $student = User::factory()->create();
        $tutor = User::factory()->create();
        $availability = $this->availabilityFor($tutor);
        $booking = $this->createBooking($student, $tutor->tutorProfile, $availability);

        try {
            $this->createBooking(User::factory()->create(), $tutor->tutorProfile, $availability);
            self::fail('A second pending booking must not reserve the same interval.');
        } catch (QueryException) {
            $this->assertDatabaseCount('bookings', 1);
        }

        $booking->forceFill(['status' => Booking::ACCEPTED])->save();

        try {
            $this->createBooking(User::factory()->create(), $tutor->tutorProfile, $availability);
            self::fail('An accepted booking must continue reserving the interval.');
        } catch (QueryException) {
            $this->assertDatabaseCount('bookings', 1);
        }

        $booking->forceFill(['status' => Booking::CANCELLED])->save();
        $replacement = $this->createBooking(User::factory()->create(), $tutor->tutorProfile, $availability);

        $this->assertModelExists($replacement);
        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_database_rejects_missing_required_booking_snapshot_fields(): void
    {
        $student = User::factory()->create();
        $tutor = User::factory()->create();
        $availability = $this->availabilityFor($tutor);

        $this->expectException(QueryException::class);
        DB::table('bookings')->insert([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
            'tutor_availability_id' => $availability->getKey(),
            'starts_at' => '2030-02-10 09:00:00',
            'status' => Booking::PENDING,
        ]);
    }

    public function test_database_rejects_a_booking_with_a_nonexistent_student(): void
    {
        $tutor = User::factory()->create();
        $availability = $this->availabilityFor($tutor);

        $this->expectException(QueryException::class);
        DB::table('bookings')->insert([
            'student_id' => 999999,
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
            'tutor_availability_id' => $availability->getKey(),
            'starts_at' => '2030-02-10 09:00:00',
            'ends_at' => '2030-02-10 10:00:00',
            'status' => Booking::PENDING,
        ]);
    }

    public function test_database_rejects_a_status_outside_the_booking_lifecycle(): void
    {
        $student = User::factory()->create();
        $tutor = User::factory()->create();
        $availability = $this->availabilityFor($tutor);

        $this->expectException(QueryException::class);
        DB::table('bookings')->insert([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
            'tutor_availability_id' => $availability->getKey(),
            'starts_at' => '2030-02-10 09:00:00',
            'ends_at' => '2030-02-10 10:00:00',
            'status' => 'unknown',
        ]);
    }

    public function test_source_availability_cannot_be_deleted_while_a_booking_preserves_its_history(): void
    {
        $student = User::factory()->create();
        $tutor = User::factory()->create();
        $availability = $this->availabilityFor($tutor);
        $booking = $this->createBooking($student, $tutor->tutorProfile, $availability);

        try {
            $availability->delete();
            self::fail('The source availability must be retained while booking history references it.');
        } catch (QueryException) {
            $this->assertModelExists($availability->fresh());
            $this->assertModelExists($booking->fresh());
        }
    }
}
