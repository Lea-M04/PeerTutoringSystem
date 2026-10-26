<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminManagementTest extends TestCase
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
        $tutor = User::factory()->create();
        $tutor->roles()->attach([
            Role::query()->where('name', Role::STUDENT)->value('id'),
            Role::query()->where('name', Role::TUTOR)->value('id'),
        ]);
        $tutor->tutorProfile()->create(['biography' => 'Approved tutor biography.']);
        $tutor->tutorApplications()->create(['motivation' => 'I support my peers.'])
            ->forceFill(['status' => TutorApplication::APPROVED])
            ->save();

        return $tutor->fresh();
    }

    public function test_admin_overview_returns_live_aggregates_and_denies_other_roles(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $student = $this->userWithRole(Role::STUDENT);
        $tutor = $this->approvedTutor();
        Subject::factory()->create(['is_active' => true]);
        $pendingTutor = $this->userWithRole(Role::STUDENT);
        $pendingTutor->tutorApplications()->create(['motivation' => 'Please review my application.']);

        $this->actingAs($admin)->getJson('/api/admin/overview')->assertOk()
            ->assertJsonPath('data.users.total', 4)
            ->assertJsonPath('data.users.active', 4)
            ->assertJsonPath('data.tutors', 1)
            ->assertJsonPath('data.pending_tutor_applications', 1)
            ->assertJsonPath('data.active_subjects', 1)
            ->assertJsonPath('data.bookings.pending', 0);

        $this->actingAs($student)->getJson('/api/admin/overview')->assertForbidden();
        $this->actingAs($tutor)->getJson('/api/admin/overview')->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/admin/overview')->assertUnauthorized();
    }

    public function test_admin_can_create_edit_and_remove_tutor_offerings_without_historical_bookings(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $tutor = $this->approvedTutor();
        $subject = Subject::factory()->create(['name' => 'Mathematics', 'is_active' => true]);

        $this->actingAs($admin)->getJson('/api/admin/tutors')->assertOk()
            ->assertJsonPath('data.0.id', $tutor->tutorProfile->getKey())
            ->assertJsonPath('data.0.name', $tutor->name);

        $created = $this->postJson('/api/admin/tutor-offerings', [
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
            'subject_id' => $subject->getKey(),
            'description' => 'Algebra and calculus.',
        ])->assertCreated()
            ->assertJsonPath('data.tutor.name', $tutor->name)
            ->assertJsonPath('data.subject.name', 'Mathematics')
            ->assertJsonPath('data.is_active', true);

        $offeringId = $created->json('data.id');
        $this->getJson('/api/admin/tutor-offerings?search=mathematics&status=active')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $offeringId);

        $this->patchJson("/api/admin/tutor-offerings/{$offeringId}", ['description' => 'Updated teaching focus.'])
            ->assertOk()->assertJsonPath('data.description', 'Updated teaching focus.');
        $this->deleteJson("/api/admin/tutor-offerings/{$offeringId}")->assertNoContent();
        $this->assertDatabaseMissing('tutor_subjects', ['id' => $offeringId]);
    }

    public function test_admin_offering_management_rejects_invalid_tutors_subjects_and_duplicates(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $tutor = $this->approvedTutor();
        $inactiveSubject = Subject::factory()->create(['is_active' => false]);
        $activeSubject = Subject::factory()->create(['is_active' => true]);
        $unapproved = $this->userWithRole(Role::STUDENT);
        $unapprovedProfile = $unapproved->tutorProfile()->create([]);

        $this->actingAs($admin)->postJson('/api/admin/tutor-offerings', [
            'tutor_profile_id' => 999999,
            'subject_id' => $activeSubject->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('tutor_profile_id');

        $this->postJson('/api/admin/tutor-offerings', [
            'tutor_profile_id' => $unapprovedProfile->getKey(),
            'subject_id' => $activeSubject->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('tutor_profile_id');

        $this->postJson('/api/admin/tutor-offerings', [
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
            'subject_id' => $inactiveSubject->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('subject_id');

        $this->postJson('/api/admin/tutor-offerings', [
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
            'subject_id' => $activeSubject->getKey(),
        ])->assertCreated();
        $this->postJson('/api/admin/tutor-offerings', [
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
            'subject_id' => $activeSubject->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('subject_id');
    }

    public function test_offerings_with_booking_history_cannot_be_removed_and_admin_can_view_bookings(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $student = $this->userWithRole(Role::STUDENT);
        $tutor = $this->approvedTutor();
        $subject = Subject::factory()->create(['name' => 'History', 'is_active' => true]);
        $offering = $tutor->tutorProfile->offerings()->create(['subject_id' => $subject->getKey()]);
        $availability = $tutor->tutorProfile->availabilities()->create([
            'starts_at' => '2032-01-02 09:00:00',
            'ends_at' => '2032-01-02 10:00:00',
        ]);
        $booking = Booking::factory()->forAvailability($availability)->create([
            'student_id' => $student->getKey(),
            'subject_id' => $subject->getKey(),
            'status' => Booking::COMPLETED,
        ]);

        $this->actingAs($admin)->deleteJson("/api/admin/tutor-offerings/{$offering->getKey()}")
            ->assertConflict();
        $this->assertDatabaseHas('tutor_subjects', ['id' => $offering->getKey()]);

        $this->getJson('/api/admin/bookings?status=completed&search='.urlencode($student->name))
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $booking->getKey())
            ->assertJsonPath('data.0.subject.name', 'History');
        $this->getJson("/api/admin/bookings/{$booking->getKey()}")
            ->assertOk()->assertJsonPath('data.tutor.name', $tutor->name);
        $this->assertDatabaseHas('bookings', ['id' => $booking->getKey(), 'status' => Booking::COMPLETED]);
    }

    public function test_students_and_tutors_cannot_access_admin_management_endpoints(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $tutor = $this->approvedTutor();
        $paths = ['/api/admin/tutors', '/api/admin/tutor-offerings', '/api/admin/bookings'];

        foreach ($paths as $path) {
            $this->actingAs($student)->getJson($path)->assertForbidden();
            $this->actingAs($tutor)->getJson($path)->assertForbidden();
        }
    }
}
