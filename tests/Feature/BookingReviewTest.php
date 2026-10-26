<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class BookingReviewTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('name', $role)->value('id'));

        return $user;
    }

    private function approvedTutor(): User
    {
        $user = $this->userWithRole(Role::STUDENT);
        $user->roles()->attach(Role::query()->where('name', Role::TUTOR)->value('id'));
        $profile = $user->tutorProfile()->create([]);
        $user->tutorApplications()->create(['motivation' => 'I can support my peers.'])
            ->forceFill(['status' => TutorApplication::APPROVED])->save();
        $subject = Subject::factory()->create(['is_active' => true]);
        $profile->offerings()->create(['subject_id' => $subject->getKey()]);

        return $user->fresh();
    }

    private function completedBooking(?User $student = null, ?User $tutor = null): Booking
    {
        $student ??= $this->userWithRole(Role::STUDENT);
        $tutor ??= $this->approvedTutor();
        $availability = $tutor->tutorProfile->availabilities()->create([
            'starts_at' => now()->subDays(2),
            'ends_at' => now()->subDays(2)->addHour(),
        ]);

        return Booking::factory()->forAvailability($availability)->create([
            'student_id' => $student->getKey(),
            'subject_id' => $tutor->tutorProfile->offerings()->value('subject_id'),
            'status' => Booking::COMPLETED,
        ]);
    }

    private function submitReview(Booking $booking, array $payload = ['rating' => 5]): TestResponse
    {
        return $this->postJson('/api/bookings/'.$booking->getKey().'/review', $payload);
    }

    public function test_student_can_review_their_completed_booking_with_optional_comment(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $booking = $this->completedBooking($student);

        $this->actingAs($student)->submitReview($booking)
            ->assertCreated()->assertJsonPath('data.status', Booking::COMPLETED)
            ->assertJsonPath('data.review.rating', 5)->assertJsonPath('data.review.comment', null)
            ->assertJsonPath('data.subject.name', $booking->subject->name);
        $this->assertDatabaseHas('reviews', ['booking_id' => $booking->getKey(), 'rating' => 5, 'comment' => null]);
    }

    public function test_rating_must_be_between_one_and_five(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $booking = $this->completedBooking($student);
        $this->actingAs($student)->submitReview($booking, ['rating' => 0])->assertUnprocessable()->assertJsonValidationErrors('rating');
        $this->actingAs($student)->submitReview($booking, ['rating' => 6])->assertUnprocessable()->assertJsonValidationErrors('rating');
        $this->assertDatabaseCount('reviews', 0);
    }

    public function test_overlong_comment_is_rejected(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $booking = $this->completedBooking($student);
        $this->actingAs($student)->submitReview($booking, ['rating' => 4, 'comment' => str_repeat('a', 1001)])
            ->assertUnprocessable()->assertJsonValidationErrors('comment');
    }

    public function test_student_cannot_review_another_students_booking(): void
    {
        $booking = $this->completedBooking();
        $this->actingAs($this->userWithRole(Role::STUDENT))->submitReview($booking)->assertForbidden();
        $this->assertDatabaseCount('reviews', 0);
    }

    public function test_user_cannot_review_a_booking_with_their_own_tutor_profile(): void
    {
        $studentTutor = $this->approvedTutor();
        $booking = $this->completedBooking($studentTutor, $studentTutor);

        $this->actingAs($studentTutor)->submitReview($booking)->assertForbidden();
        $this->assertDatabaseCount('reviews', 0);
    }

    public function test_only_completed_bookings_are_reviewable(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $tutor = $this->approvedTutor();
        foreach ([Booking::PENDING, Booking::ACCEPTED, Booking::REJECTED, Booking::CANCELLED] as $status) {
            $availability = $tutor->tutorProfile->availabilities()->create([
                'starts_at' => now()->addDays(3), 'ends_at' => now()->addDays(3)->addHour(),
            ]);
            $booking = Booking::factory()->forAvailability($availability)->create([
                'student_id' => $student->getKey(), 'status' => $status,
            ]);
            $this->actingAs($student)->submitReview($booking)->assertForbidden();
        }
    }

    public function test_duplicate_review_is_rejected_and_database_enforces_one_per_booking(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $booking = $this->completedBooking($student);
        $this->actingAs($student)->submitReview($booking)->assertCreated();
        $this->actingAs($student)->submitReview($booking)->assertConflict();
        $this->assertDatabaseCount('reviews', 1);
    }

    public function test_student_booking_history_returns_their_existing_review(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $booking = $this->completedBooking($student);
        $booking->review()->create(['rating' => 4, 'comment' => 'Good support.']);

        $this->actingAs($student)->getJson('/api/bookings/'.$booking->getKey())
            ->assertOk()->assertJsonPath('data.review.rating', 4)
            ->assertJsonPath('data.review.comment', 'Good support.');
    }

    public function test_unauthenticated_users_and_admins_cannot_submit_reviews(): void
    {
        $booking = $this->completedBooking();
        $this->submitReview($booking)->assertUnauthorized();
        $this->actingAs($this->userWithRole(Role::ADMIN))->submitReview($booking)->assertForbidden();
        $this->assertDatabaseCount('reviews', 0);
    }

    public function test_tutor_can_only_view_reviews_for_their_own_profile(): void
    {
        $booking = $this->completedBooking();
        $student = User::query()->findOrFail($booking->student_id);
        $this->actingAs($student)->submitReview($booking, ['rating' => 4, 'comment' => 'Clear explanation.'])->assertCreated();
        $this->actingAs($booking->tutorProfile->user)->getJson('/api/tutor-profile/reviews')
            ->assertOk()->assertJsonPath('meta.average_rating', 4)->assertJsonPath('meta.review_count', 1)
            ->assertJsonPath('data.0.rating', 4)->assertJsonMissingPath('data.0.reviewer.email');
        $this->actingAs($this->approvedTutor())->getJson('/api/tutor-profile/reviews')->assertOk()->assertJsonPath('meta.review_count', 0);
    }

    public function test_tutor_review_endpoint_rejects_guests_students_and_admins(): void
    {
        $this->getJson('/api/tutor-profile/reviews')->assertUnauthorized();
        $this->actingAs($this->userWithRole(Role::STUDENT))->getJson('/api/tutor-profile/reviews')->assertForbidden();
        $this->actingAs($this->userWithRole(Role::ADMIN))->getJson('/api/tutor-profile/reviews')->assertForbidden();
    }

    public function test_tutor_directory_returns_aggregate_and_reviews_without_student_email(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $booking = $this->completedBooking($student);
        $this->actingAs($student)->submitReview($booking, ['rating' => 3, 'comment' => 'Helpful session.'])->assertCreated();
        $response = $this->actingAs($student)->getJson('/api/tutors/'.$booking->tutor_profile_id);
        $response->assertOk()->assertJsonPath('data.average_rating', 3)->assertJsonPath('data.review_count', 1)
            ->assertJsonPath('data.reviews.0.rating', 3)->assertJsonMissingPath('data.reviews.0.reviewer.email')
            ->assertJsonMissingPath('data.user.email');
    }

    public function test_review_has_booking_relationship_and_database_unique_constraint(): void
    {
        $booking = $this->completedBooking();
        $review = $booking->review()->create(['rating' => 2]);
        $this->assertSame($booking->getKey(), $review->booking->getKey());
        $this->expectException(QueryException::class);
        $booking->review()->create(['rating' => 3]);
    }
}
