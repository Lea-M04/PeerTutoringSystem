<?php

namespace Tests\Feature\Api;

use App\Models\Booking;
use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\TutorAvailability;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class BookingManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->travelTo('2030-01-01 08:00:00 UTC');
    }

    private function student(): User
    {
        $student = User::factory()->create();
        $student->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));

        return $student;
    }

    private function approvedTutor(bool $withActiveOffering = true): User
    {
        $tutor = User::factory()->create();
        $tutor->roles()->attach([
            Role::query()->where('name', Role::STUDENT)->value('id'),
            Role::query()->where('name', Role::TUTOR)->value('id'),
        ]);
        $profile = $tutor->tutorProfile()->create([]);
        $tutor->tutorApplications()->create(['motivation' => 'I enjoy helping fellow students.'])
            ->forceFill(['status' => TutorApplication::APPROVED])
            ->save();

        if ($withActiveOffering) {
            $subject = Subject::factory()->create(['is_active' => true]);
            $profile->offerings()->create(['subject_id' => $subject->getKey()]);
        }

        return $tutor->fresh();
    }

    private function availability(User $tutor, string $startsAt = '2030-01-02 09:00:00', string $endsAt = '2030-01-02 10:00:00'): TutorAvailability
    {
        $profile = $tutor->tutorProfile()->firstOrCreate([]);

        return $profile->availabilities()->create([
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
        ]);
    }

    private function requestBooking(User $student, TutorAvailability $availability): TestResponse
    {
        return $this->actingAs($student)->postJson('/api/bookings', [
            'availability_id' => $availability->getKey(),
            'tutor_subject_id' => $availability->tutorProfile->offerings()->value('id'),
        ]);
    }

    public function test_student_creates_pending_booking_with_server_derived_identity_and_interval_snapshot(): void
    {
        $student = $this->student();
        $otherStudent = $this->student();
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);

        $response = $this->actingAs($student)->postJson('/api/bookings', [
            'availability_id' => $availability->getKey(),
            'student_id' => $otherStudent->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('student_id');

        $this->assertDatabaseCount('bookings', 0);

        $created = $this->requestBooking($student, $availability)
            ->assertCreated()
            ->assertJsonPath('data.status', Booking::PENDING)
            ->assertJsonPath('data.starts_at', '2030-01-02T09:00:00.000000Z')
            ->assertJsonPath('data.ends_at', '2030-01-02T10:00:00.000000Z')
            ->assertJsonPath('data.subject.id', $tutor->tutorProfile->offerings()->value('subject_id'))
            ->assertJsonPath('data.subject.name', $tutor->tutorProfile->offerings()->first()->subject->name)
            ->assertJsonMissingPath('data.student.email');

        $this->assertDatabaseHas('bookings', [
            'id' => $created->json('data.id'),
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
            'tutor_availability_id' => $availability->getKey(),
            'subject_id' => $tutor->tutorProfile->offerings()->value('subject_id'),
            'starts_at' => '2030-01-02 09:00:00',
            'ends_at' => '2030-01-02 10:00:00',
            'status' => Booking::PENDING,
        ]);
    }

    public function test_unauthenticated_and_non_student_users_cannot_create_bookings(): void
    {
        $availability = $this->availability($this->approvedTutor());

        $this->postJson('/api/bookings', ['availability_id' => $availability->getKey()])->assertUnauthorized();
        $this->actingAs(User::factory()->create())
            ->postJson('/api/bookings', ['availability_id' => $availability->getKey()])
            ->assertForbidden();
        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_client_cannot_supply_booking_status_or_source_snapshot_values(): void
    {
        $student = $this->student();
        $availability = $this->availability($this->approvedTutor());

        $this->actingAs($student)->postJson('/api/bookings', [
            'availability_id' => $availability->getKey(),
            'status' => Booking::ACCEPTED,
            'tutor_profile_id' => 999,
            'starts_at' => '2030-01-03T09:00:00Z',
            'ends_at' => '2030-01-03T10:00:00Z',
            'subject_id' => 999,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['status', 'tutor_profile_id', 'starts_at', 'ends_at', 'subject_id']);

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_booking_requires_an_existing_availability_identifier(): void
    {
        $this->actingAs($this->student())->postJson('/api/bookings', ['availability_id' => 999999])
            ->assertUnprocessable()->assertJsonValidationErrors('availability_id');
    }

    public function test_booking_rejects_an_offering_from_another_tutor(): void
    {
        $student = $this->student();
        $availability = $this->availability($this->approvedTutor());
        $otherTutor = $this->approvedTutor();

        $this->actingAs($student)->postJson('/api/bookings', [
            'availability_id' => $availability->getKey(),
            'tutor_subject_id' => $otherTutor->tutorProfile->offerings()->value('id'),
        ])->assertUnprocessable()->assertJsonValidationErrors('tutor_subject_id');

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_booking_rejects_inactive_or_nonexistent_offerings(): void
    {
        $student = $this->student();
        $tutor = $this->approvedTutor(false);
        $inactiveSubject = Subject::factory()->create(['is_active' => false]);
        $inactiveOffering = $tutor->tutorProfile->offerings()->create(['subject_id' => $inactiveSubject->getKey()]);
        $availability = $this->availability($tutor);

        $this->actingAs($student)->postJson('/api/bookings', [
            'availability_id' => $availability->getKey(),
            'tutor_subject_id' => $inactiveOffering->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('tutor_subject_id');

        $this->actingAs($student)->postJson('/api/bookings', [
            'availability_id' => $availability->getKey(),
            'tutor_subject_id' => 999999,
        ])->assertUnprocessable()->assertJsonValidationErrors('tutor_subject_id');

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_historical_booking_without_subject_returns_a_safe_null_subject(): void
    {
        $student = $this->student();
        $availability = $this->availability($this->approvedTutor());
        $booking = Booking::factory()->forAvailability($availability)->create(['student_id' => $student->getKey()]);

        $this->actingAs($student)->getJson("/api/bookings/{$booking->getKey()}")
            ->assertOk()->assertJsonPath('data.subject', null);
    }

    public function test_student_cannot_book_their_own_availability(): void
    {
        $studentAndTutor = $this->approvedTutor();
        $availability = $this->availability($studentAndTutor);

        $this->requestBooking($studentAndTutor, $availability)->assertUnprocessable()
            ->assertJsonValidationErrors('availability_id');
        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_expired_availability_is_rejected(): void
    {
        $availability = $this->availability($this->approvedTutor(), '2030-01-01 07:00:00', '2030-01-01 08:00:00');

        $this->requestBooking($this->student(), $availability)->assertUnprocessable()
            ->assertJsonValidationErrors('availability_id');
        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_availability_that_has_started_cannot_be_booked_even_if_it_has_not_ended(): void
    {
        $this->travelTo('2030-01-02 09:30:00 UTC');
        $availability = $this->availability($this->approvedTutor(), '2030-01-02 09:00:00', '2030-01-02 10:00:00');

        $this->requestBooking($this->student(), $availability)->assertUnprocessable()
            ->assertJsonValidationErrors('availability_id');

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_unapproved_tutors_and_tutors_without_active_offerings_are_not_bookable(): void
    {
        $unapproved = User::factory()->create();
        $unapproved->roles()->attach([
            Role::query()->where('name', Role::STUDENT)->value('id'),
            Role::query()->where('name', Role::TUTOR)->value('id'),
        ]);
        $unapproved->tutorProfile()->create([]);
        $unapprovedSubject = Subject::factory()->create(['is_active' => true]);
        $unapproved->tutorProfile->offerings()->create(['subject_id' => $unapprovedSubject->getKey()]);
        $unapproved->tutorApplications()->create(['motivation' => 'Pending review.']);

        $withoutOffering = $this->approvedTutor(false);
        $inactiveSubject = Subject::factory()->create(['is_active' => false]);
        $withoutOffering->tutorProfile->offerings()->create(['subject_id' => $inactiveSubject->getKey()]);

        $this->requestBooking($this->student(), $this->availability($unapproved))
            ->assertUnprocessable()->assertJsonValidationErrors('availability_id');
        $this->requestBooking($this->student(), $this->availability($withoutOffering))
            ->assertUnprocessable()->assertJsonValidationErrors('tutor_subject_id');

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_duplicate_active_booking_is_rejected_with_conflict_and_no_extra_record(): void
    {
        $availability = $this->availability($this->approvedTutor());
        $student = $this->student();

        $this->requestBooking($student, $availability)->assertCreated();
        $this->requestBooking($this->student(), $availability)->assertUnprocessable()
            ->assertJsonValidationErrors('availability_id');

        $this->assertDatabaseCount('bookings', 1);
    }

    public function test_general_availability_is_shared_across_subjects_and_reservation_is_subject_independent(): void
    {
        $tutor = $this->approvedTutor();
        $profile = $tutor->tutorProfile;
        $firstOffering = $profile->offerings()->with('subject')->firstOrFail();
        $secondSubject = Subject::factory()->create(['is_active' => true]);
        $secondOffering = $profile->offerings()->create(['subject_id' => $secondSubject->getKey()]);
        $availability = collect([
            $this->availability($tutor, '2030-01-02 09:00:00', '2030-01-02 10:00:00'),
            $this->availability($tutor, '2030-01-02 11:00:00', '2030-01-02 12:00:00'),
            $this->availability($tutor, '2030-01-02 13:00:00', '2030-01-02 14:00:00'),
        ]);

        $firstStudent = $this->student();
        $initialIntervals = $this->actingAs($firstStudent)
            ->getJson("/api/tutors/{$profile->getKey()}/availability")
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $this->assertSame(
            $availability->pluck('id')->sort()->values()->all(),
            collect($initialIntervals->json('data'))->pluck('id')->sort()->values()->all(),
        );

        $firstBooking = $this->postJson('/api/bookings', [
            'availability_id' => $availability[0]->getKey(),
            'tutor_subject_id' => $firstOffering->getKey(),
        ])->assertCreated()
            ->assertJsonPath('data.subject.id', $firstOffering->subject->getKey())
            ->assertJsonPath('data.subject.name', $firstOffering->subject->name);

        $secondStudent = $this->student();
        $this->actingAs($secondStudent)->postJson('/api/bookings', [
            'availability_id' => $availability[0]->getKey(),
            'tutor_subject_id' => $secondOffering->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('availability_id');

        $remainingIntervals = $this->actingAs($secondStudent)
            ->getJson("/api/tutors/{$profile->getKey()}/availability")
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->assertSame(
            $availability->slice(1)->pluck('id')->sort()->values()->all(),
            collect($remainingIntervals->json('data'))->pluck('id')->sort()->values()->all(),
        );

        $secondBooking = $this->postJson('/api/bookings', [
            'availability_id' => $availability[1]->getKey(),
            'tutor_subject_id' => $secondOffering->getKey(),
        ])->assertCreated()
            ->assertJsonPath('data.subject.id', $secondSubject->getKey())
            ->assertJsonPath('data.subject.name', $secondSubject->name);

        $this->assertDatabaseHas('bookings', [
            'id' => $firstBooking->json('data.id'),
            'tutor_availability_id' => $availability[0]->getKey(),
            'subject_id' => $firstOffering->subject->getKey(),
        ]);
        $this->assertDatabaseHas('bookings', [
            'id' => $secondBooking->json('data.id'),
            'tutor_availability_id' => $availability[1]->getKey(),
            'subject_id' => $secondSubject->getKey(),
        ]);
        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_rejected_or_cancelled_booking_releases_interval_for_rebooking(): void
    {
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $student = $this->student();
        $created = $this->requestBooking($student, $availability)->assertCreated();
        $bookingId = $created->json('data.id');

        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$bookingId}/reject")
            ->assertOk()->assertJsonPath('data.status', Booking::REJECTED);
        $this->actingAs($student)->getJson('/api/bookings')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $bookingId)
            ->assertJsonPath('data.0.status', Booking::REJECTED);
        $replacementStudent = $this->student();
        $replacementId = $this->requestBooking($replacementStudent, $availability)->assertCreated()->json('data.id');
        $this->actingAs($replacementStudent)->getJson('/api/bookings')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $replacementId)
            ->assertJsonPath('data.0.status', Booking::PENDING);

        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_cancelled_booking_releases_interval_for_a_new_student_request(): void
    {
        $this->travelTo('2030-01-02 08:00:00 UTC');
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor, '2030-01-02 20:00:00', '2030-01-02 21:00:00');
        $student = $this->student();
        $bookingId = $this->requestBooking($student, $availability)->assertCreated()->json('data.id');

        $this->postJson("/api/bookings/{$bookingId}/cancel")->assertOk()
            ->assertJsonPath('data.status', Booking::CANCELLED);
        $this->actingAs($student)->getJson('/api/bookings')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $bookingId)
            ->assertJsonPath('data.0.status', Booking::CANCELLED);
        $replacementStudent = $this->student();
        $replacementId = $this->requestBooking($replacementStudent, $availability)->assertCreated()->json('data.id');
        $this->actingAs($replacementStudent)->getJson('/api/bookings')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $replacementId)
            ->assertJsonPath('data.0.status', Booking::PENDING);

        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_student_can_list_and_view_only_their_own_bookings(): void
    {
        $availability = $this->availability($this->approvedTutor());
        $owner = $this->student();
        $other = $this->student();
        $ownBookingId = $this->requestBooking($owner, $availability)->assertCreated()->json('data.id');

        $secondAvailability = $this->availability($this->approvedTutor(), '2030-01-03 09:00:00', '2030-01-03 10:00:00');
        $otherBookingId = $this->requestBooking($other, $secondAvailability)->assertCreated()->json('data.id');

        $this->actingAs($owner)->getJson('/api/bookings')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $ownBookingId)
            ->assertJsonPath('data.0.subject.name', $availability->tutorProfile->offerings()->first()->subject->name);
        $this->getJson("/api/bookings/{$ownBookingId}")->assertOk()
            ->assertJsonPath('data.id', $ownBookingId)
            ->assertJsonPath('data.subject.name', $availability->tutorProfile->offerings()->first()->subject->name);
        $this->getJson("/api/bookings/{$otherBookingId}")->assertForbidden();
    }

    public function test_only_the_owning_approved_tutor_can_view_and_decide_incoming_bookings(): void
    {
        $tutor = $this->approvedTutor();
        $otherTutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');

        $this->actingAs($tutor)->getJson('/api/tutor-profile/bookings')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $bookingId)
            ->assertJsonPath('data.0.subject.name', $availability->tutorProfile->offerings()->first()->subject->name);
        $this->getJson("/api/tutor-profile/bookings/{$bookingId}")->assertOk()
            ->assertJsonPath('data.subject.name', $availability->tutorProfile->offerings()->first()->subject->name);
        $this->postJson("/api/tutor-profile/bookings/{$bookingId}/accept")->assertOk()
            ->assertJsonPath('data.status', Booking::ACCEPTED);
        $this->postJson("/api/tutor-profile/bookings/{$bookingId}/reject")->assertStatus(409);

        $this->actingAs($otherTutor)->getJson("/api/tutor-profile/bookings/{$bookingId}")->assertForbidden();
        $this->postJson("/api/tutor-profile/bookings/{$bookingId}/accept")->assertForbidden();
        $this->postJson("/api/tutor-profile/bookings/{$bookingId}/reject")->assertForbidden();
        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::ACCEPTED]);
    }

    public function test_student_and_admin_cannot_access_tutor_booking_management(): void
    {
        $student = $this->student();
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->where('name', Role::ADMIN)->value('id'));

        $this->getJson('/api/tutor-profile/bookings')->assertUnauthorized();
        $this->actingAs($student)->getJson('/api/tutor-profile/bookings')->assertForbidden();
        $this->actingAs($admin)->getJson('/api/tutor-profile/bookings')->assertForbidden();
    }

    public function test_unapproved_tutor_cannot_access_tutor_booking_management(): void
    {
        $tutor = User::factory()->create();
        $tutor->roles()->attach(Role::query()->where('name', Role::TUTOR)->value('id'));
        $tutor->tutorProfile()->create([]);
        $tutor->tutorApplications()->create(['motivation' => 'Awaiting review.']);

        $this->actingAs($tutor)->getJson('/api/tutor-profile/bookings')->assertForbidden();
    }

    public function test_booking_lists_are_rejected_for_unauthenticated_users(): void
    {
        $this->getJson('/api/bookings')->assertUnauthorized();
        $this->getJson('/api/tutor-profile/bookings')->assertUnauthorized();
    }

    public function test_unauthenticated_users_cannot_view_or_change_individual_bookings(): void
    {
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');
        $this->app['auth']->forgetGuards();

        $this->getJson("/api/bookings/{$bookingId}")->assertUnauthorized();
        $this->postJson("/api/bookings/{$bookingId}/cancel")->assertUnauthorized();
        $this->getJson("/api/tutor-profile/bookings/{$bookingId}")->assertUnauthorized();
        $this->postJson("/api/tutor-profile/bookings/{$bookingId}/accept")->assertUnauthorized();
        $this->postJson("/api/tutor-profile/bookings/{$bookingId}/reject")->assertUnauthorized();

        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::PENDING]);
    }

    public function test_admin_cannot_access_student_booking_resources_or_actions(): void
    {
        $availability = $this->availability($this->approvedTutor());
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->where('name', Role::ADMIN)->value('id'));

        $this->actingAs($admin)->getJson('/api/bookings')->assertForbidden();
        $this->getJson("/api/bookings/{$bookingId}")->assertForbidden();
        $this->postJson("/api/bookings/{$bookingId}/cancel")->assertForbidden();

        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::PENDING]);
    }

    public function test_student_cannot_call_tutor_decision_endpoints(): void
    {
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');

        $this->actingAs($this->student())->postJson("/api/tutor-profile/bookings/{$bookingId}/accept")->assertForbidden();
        $this->postJson("/api/tutor-profile/bookings/{$bookingId}/reject")->assertForbidden();
        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::PENDING]);
    }

    public function test_student_cancellation_is_allowed_at_exactly_twelve_hours_before_start(): void
    {
        $this->travelTo('2030-01-02 08:00:00 UTC');
        $availability = $this->availability($this->approvedTutor(), '2030-01-02 20:00:00', '2030-01-02 21:00:00');
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');

        $this->postJson("/api/bookings/{$bookingId}/cancel")->assertOk()
            ->assertJsonPath('data.status', Booking::CANCELLED);
        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::CANCELLED]);
    }

    public function test_student_can_cancel_an_accepted_booking_at_least_twelve_hours_before_start(): void
    {
        $this->travelTo('2030-01-02 08:00:00 UTC');
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor, '2030-01-02 21:00:00', '2030-01-02 22:00:00');
        $student = $this->student();
        $bookingId = $this->requestBooking($student, $availability)->assertCreated()->json('data.id');

        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$bookingId}/accept")->assertOk();
        $this->actingAs($student)->postJson("/api/bookings/{$bookingId}/cancel")->assertOk()
            ->assertJsonPath('data.status', Booking::CANCELLED);
    }

    public function test_student_cancellation_is_rejected_inside_twelve_hour_window(): void
    {
        $this->travelTo('2030-01-02 08:00:00 UTC');
        $availability = $this->availability($this->approvedTutor(), '2030-01-02 19:59:00', '2030-01-02 20:59:00');
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');

        $this->postJson("/api/bookings/{$bookingId}/cancel")->assertStatus(409);
        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::PENDING]);
    }

    public function test_student_cannot_cancel_another_students_booking_or_non_reserving_booking(): void
    {
        $availability = $this->availability($this->approvedTutor());
        $owner = $this->student();
        $bookingId = $this->requestBooking($owner, $availability)->assertCreated()->json('data.id');

        $this->actingAs($this->student())->postJson("/api/bookings/{$bookingId}/cancel")->assertForbidden();
        $this->actingAs($owner)->postJson("/api/bookings/{$bookingId}/cancel")->assertOk();
        $this->postJson("/api/bookings/{$bookingId}/cancel")->assertStatus(409);
    }

    public function test_pending_or_accepted_booking_prevents_source_availability_edit_and_delete(): void
    {
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');

        $this->actingAs($tutor)->putJson("/api/tutor-profile/availability/{$availability->getKey()}", [
            'starts_at' => '2030-01-02T11:00:00Z',
            'ends_at' => '2030-01-02T12:00:00Z',
        ])->assertStatus(409);
        $this->deleteJson("/api/tutor-profile/availability/{$availability->getKey()}")->assertStatus(409);

        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::PENDING]);
        $this->assertDatabaseHas('tutor_availabilities', ['id' => $availability->getKey(), 'starts_at' => '2030-01-02 09:00:00']);
    }

    public function test_accepted_booking_also_prevents_source_availability_edit_and_delete(): void
    {
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');
        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$bookingId}/accept")->assertOk();

        $this->putJson("/api/tutor-profile/availability/{$availability->getKey()}", [
            'starts_at' => '2030-01-02T11:00:00Z',
            'ends_at' => '2030-01-02T12:00:00Z',
        ])->assertStatus(409);
        $this->deleteJson("/api/tutor-profile/availability/{$availability->getKey()}")->assertStatus(409);

        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::ACCEPTED]);
    }

    public function test_owning_tutor_completes_an_accepted_ended_session_and_student_can_review_it(): void
    {
        $tutor = $this->approvedTutor();
        $student = $this->student();
        $availability = $this->availability($tutor, '2030-01-02 09:00:00', '2030-01-02 10:00:00');
        $bookingId = $this->requestBooking($student, $availability)->assertCreated()->json('data.id');

        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$bookingId}/accept")
            ->assertOk()->assertJsonPath('data.status', Booking::ACCEPTED);
        $this->travelTo('2030-01-02 10:01:00 UTC');
        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$bookingId}/complete")
            ->assertOk()->assertJsonPath('data.status', Booking::COMPLETED);
        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::COMPLETED]);

        $this->actingAs($student)->postJson("/api/bookings/{$bookingId}/review", [
            'rating' => 5,
            'comment' => 'A helpful session.',
        ])->assertCreated()->assertJsonPath('data.review.rating', 5);
        $this->actingAs($tutor)->getJson('/api/tutor-profile/reviews')
            ->assertOk()->assertJsonPath('meta.average_rating', 5)->assertJsonPath('meta.review_count', 1);
    }

    public function test_tutor_cannot_complete_a_booking_before_its_end_time(): void
    {
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');
        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$bookingId}/accept")->assertOk();

        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$bookingId}/complete")
            ->assertConflict()->assertJsonPath('message', 'A booking can only be completed after its session end time.');
        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::ACCEPTED]);
    }

    public function test_only_the_owning_tutor_can_complete_and_students_are_forbidden(): void
    {
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');
        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$bookingId}/accept")->assertOk();
        $this->travelTo('2030-01-02 10:01:00 UTC');

        $this->actingAs($this->student())->postJson("/api/tutor-profile/bookings/{$bookingId}/complete")->assertForbidden();
        $this->actingAs($this->approvedTutor())->postJson("/api/tutor-profile/bookings/{$bookingId}/complete")->assertForbidden();
        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::ACCEPTED]);
    }

    public function test_non_accepted_booking_cannot_be_completed_after_its_end_time(): void
    {
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');
        $this->travelTo('2030-01-02 10:01:00 UTC');

        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$bookingId}/complete")
            ->assertConflict()->assertJsonPath('message', 'Only accepted bookings can be marked as completed.');
        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::PENDING]);
    }

    public function test_unauthenticated_user_cannot_complete_a_booking(): void
    {
        $tutor = $this->approvedTutor();
        $bookingId = $this->requestBooking($this->student(), $this->availability($tutor))->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();
        $this->postJson("/api/tutor-profile/bookings/{$bookingId}/complete")->assertUnauthorized();
    }

    public function test_released_booking_allows_availability_edit_but_history_prevents_delete(): void
    {
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $bookingId = $this->requestBooking($this->student(), $availability)->assertCreated()->json('data.id');

        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$bookingId}/reject")->assertOk();
        $this->putJson("/api/tutor-profile/availability/{$availability->getKey()}", [
            'starts_at' => '2030-01-02T11:00:00Z',
            'ends_at' => '2030-01-02T12:00:00Z',
        ])->assertOk();
        $this->deleteJson("/api/tutor-profile/availability/{$availability->getKey()}")->assertStatus(409);

        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => Booking::REJECTED]);
        $this->assertDatabaseHas('tutor_availabilities', ['id' => $availability->getKey(), 'starts_at' => '2030-01-02 11:00:00']);
    }
}
