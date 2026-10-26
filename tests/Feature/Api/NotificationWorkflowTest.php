<?php

namespace Tests\Feature\Api;

use App\Models\Booking;
use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\TutorAvailability;
use App\Models\User;
use App\Services\InAppNotificationService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class NotificationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->travelTo('2030-01-01 08:00:00 UTC');
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('name', $role)->value('id'));

        return $user;
    }

    private function approvedTutor(): User
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
        $subject = Subject::factory()->create(['is_active' => true]);
        $profile->offerings()->create(['subject_id' => $subject->id]);

        return $tutor->fresh();
    }

    private function availability(User $tutor, string $date = '2030-01-02'): TutorAvailability
    {
        return $tutor->tutorProfile->availabilities()->create([
            'starts_at' => "{$date} 09:00:00",
            'ends_at' => "{$date} 10:00:00",
        ]);
    }

    private function requestBooking(User $student, TutorAvailability $availability): Booking
    {
        $response = $this->actingAs($student)->postJson('/api/bookings', [
            'availability_id' => $availability->id,
            'tutor_subject_id' => $availability->tutorProfile->offerings()->value('id'),
        ])->assertCreated();

        return Booking::query()->findOrFail($response->json('data.id'));
    }

    public function test_booking_request_notifies_only_the_owning_tutor_and_is_idempotent(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        $booking = $this->requestBooking($student, $availability);

        app(InAppNotificationService::class)->bookingRequested($booking);
        app(InAppNotificationService::class)->bookingRequested($booking);

        $this->assertDatabaseCount('in_app_notifications', 1);
        $this->assertDatabaseHas('in_app_notifications', [
            'user_id' => $tutor->id,
            'event_key' => "booking:{$booking->id}:requested",
            'type' => 'booking_requested',
            'booking_id' => $booking->id,
        ]);
        $this->assertDatabaseMissing('in_app_notifications', ['user_id' => $student->id, 'type' => 'booking_requested']);
    }

    public function test_tutor_acceptance_and_rejection_notify_the_correct_students(): void
    {
        $tutor = $this->approvedTutor();
        $firstStudent = $this->userWithRole(Role::STUDENT);
        $secondStudent = $this->userWithRole(Role::STUDENT);
        $acceptedBooking = $this->requestBooking($firstStudent, $this->availability($tutor));
        $rejectedBooking = $this->requestBooking($secondStudent, $this->availability($tutor, '2030-01-03'));

        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$acceptedBooking->id}/accept")->assertOk();
        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$rejectedBooking->id}/reject")->assertOk();

        $this->assertDatabaseHas('in_app_notifications', [
            'user_id' => $firstStudent->id,
            'event_key' => "booking:{$acceptedBooking->id}:accepted",
            'type' => 'booking_accepted',
        ]);
        $this->assertDatabaseHas('in_app_notifications', [
            'user_id' => $secondStudent->id,
            'event_key' => "booking:{$rejectedBooking->id}:rejected",
            'type' => 'booking_rejected',
        ]);
        $this->assertDatabaseMissing('in_app_notifications', ['user_id' => $tutor->id, 'type' => 'booking_accepted']);
    }

    public function test_successful_student_cancellation_notifies_only_the_tutor(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $tutor = $this->approvedTutor();
        $booking = $this->requestBooking($student, $this->availability($tutor));

        $this->actingAs($student)->postJson("/api/bookings/{$booking->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', Booking::CANCELLED);

        $this->assertDatabaseHas('in_app_notifications', [
            'user_id' => $tutor->id,
            'event_key' => "booking:{$booking->id}:cancelled",
            'type' => 'booking_cancelled',
        ]);
        $this->assertDatabaseMissing('in_app_notifications', ['user_id' => $student->id, 'type' => 'booking_cancelled']);
    }

    public function test_successful_booking_completion_notifies_the_student_that_review_may_be_available(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $tutor = $this->approvedTutor();
        $booking = $this->requestBooking($student, $this->availability($tutor));
        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$booking->id}/accept")->assertOk();
        $this->travelTo('2030-01-02 10:01:00 UTC');

        $this->actingAs($tutor)->postJson("/api/tutor-profile/bookings/{$booking->id}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', Booking::COMPLETED);

        $this->assertDatabaseHas('in_app_notifications', [
            'user_id' => $student->id,
            'event_key' => "booking:{$booking->id}:completed",
            'type' => 'booking_completed',
            'message' => 'Your tutoring session is complete. If eligible, you can now leave a review.',
        ]);
    }

    public function test_approval_and_rejection_notify_the_tutor_application_applicant(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $approvedApplicant = $this->userWithRole(Role::STUDENT);
        $rejectedApplicant = $this->userWithRole(Role::STUDENT);
        $approvedApplication = TutorApplication::factory()->for($approvedApplicant, 'applicant')->create();
        $rejectedApplication = TutorApplication::factory()->for($rejectedApplicant, 'applicant')->create();

        $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$approvedApplication->id}/approve")->assertOk();
        $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$rejectedApplication->id}/reject", [
            'reason' => 'Please provide more detail about your subject experience.',
        ])->assertOk();

        $this->assertDatabaseHas('in_app_notifications', [
            'user_id' => $approvedApplicant->id,
            'event_key' => "tutor-application:{$approvedApplication->id}:approved",
            'type' => 'tutor_application_approved',
        ]);
        $this->assertDatabaseHas('in_app_notifications', [
            'user_id' => $rejectedApplicant->id,
            'event_key' => "tutor-application:{$rejectedApplication->id}:rejected",
            'type' => 'tutor_application_rejected',
        ]);
        $this->assertDatabaseCount('in_app_notifications', 2);
    }

    public function test_failed_operations_do_not_create_notifications(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $tutor = $this->approvedTutor();
        $admin = $this->userWithRole(Role::ADMIN);
        $availability = $this->availability($tutor);

        $this->actingAs($student)->postJson('/api/bookings', ['availability_id' => 999999])
            ->assertUnprocessable();
        $this->actingAs($admin)->postJson('/api/bookings', [
            'availability_id' => $availability->id,
            'tutor_subject_id' => $availability->tutorProfile->offerings()->value('id'),
        ])
            ->assertForbidden();

        $this->assertDatabaseCount('bookings', 0);
        $this->assertDatabaseCount('in_app_notifications', 0);
    }

    public function test_notification_write_failure_rolls_back_booking_creation(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $tutor = $this->approvedTutor();
        $availability = $this->availability($tutor);
        DB::statement("CREATE TRIGGER fail_in_app_notification BEFORE INSERT ON in_app_notifications BEGIN SELECT RAISE(ABORT, 'simulated notification failure'); END");

        try {
            $this->actingAs($student)->postJson('/api/bookings', [
                'availability_id' => $availability->id,
                'tutor_subject_id' => $availability->tutorProfile->offerings()->value('id'),
            ])->assertServerError();
        } finally {
            DB::statement('DROP TRIGGER IF EXISTS fail_in_app_notification');
        }

        $this->assertDatabaseCount('bookings', 0);
        $this->assertDatabaseCount('in_app_notifications', 0);
    }

    public function test_notification_write_failure_rolls_back_tutor_application_approval(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $applicant = $this->userWithRole(Role::STUDENT);
        $application = TutorApplication::factory()->for($applicant, 'applicant')->create();
        DB::statement("CREATE TRIGGER fail_in_app_notification BEFORE INSERT ON in_app_notifications BEGIN SELECT RAISE(ABORT, 'simulated notification failure'); END");

        try {
            $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$application->id}/approve")->assertServerError();
        } finally {
            DB::statement('DROP TRIGGER IF EXISTS fail_in_app_notification');
        }

        $this->assertDatabaseHas('tutor_applications', ['id' => $application->id, 'status' => TutorApplication::PENDING]);
        $this->assertFalse($applicant->fresh()->hasRole(Role::TUTOR));
        $this->assertDatabaseCount('tutor_profiles', 0);
        $this->assertDatabaseCount('in_app_notifications', 0);
    }
}
