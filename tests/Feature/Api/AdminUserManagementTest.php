<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminUserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->travelTo('2030-01-01 08:00:00');
    }

    private function userWithRoles(string ...$roles): User
    {
        $user = User::factory()->create([
            'first_name' => 'Alex',
            'last_name' => 'Student',
            'faculty_or_university' => 'Example Faculty',
            'study_program' => 'Computer Science',
            'year_of_study' => 2,
            'biography' => 'A profile biography.',
        ]);
        $user->roles()->attach(Role::query()->whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function approvedTutor(): User
    {
        $tutor = $this->userWithRoles(Role::STUDENT, Role::TUTOR);
        $profile = $tutor->tutorProfile()->create(['biography' => 'Tutor profile biography.']);
        $application = $tutor->tutorApplications()->create(['motivation' => 'I like teaching.']);
        $application->forceFill(['status' => TutorApplication::APPROVED])->save();

        return $tutor->setRelation('tutorProfile', $profile);
    }

    public function test_admin_can_list_and_view_read_only_student_and_tutor_profiles_without_sensitive_fields(): void
    {
        $admin = $this->userWithRoles(Role::ADMIN);
        $student = $this->userWithRoles(Role::STUDENT);
        $tutor = $this->approvedTutor();
        $active = Subject::factory()->create(['name' => 'Physics', 'is_active' => true]);
        $inactive = Subject::factory()->create(['name' => 'Archived subject', 'is_active' => false]);
        $tutor->tutorProfile->offerings()->create(['subject_id' => $active->id, 'description' => 'Mechanics and waves.']);
        $tutor->tutorProfile->offerings()->create(['subject_id' => $inactive->id, 'description' => 'Should not appear.']);
        $availability = $tutor->tutorProfile->availabilities()->create([
            'starts_at' => '2030-01-02 09:00:00',
            'ends_at' => '2030-01-02 10:00:00',
        ]);
        $pastAvailability = $tutor->tutorProfile->availabilities()->create([
            'starts_at' => '2029-12-31 09:00:00',
            'ends_at' => '2029-12-31 10:00:00',
        ]);
        $tutor->tutorApplications()->firstOrFail()->forceFill(['transcript_path' => 'private/transcript.pdf'])->save();

        $this->actingAs($admin)->getJson('/api/admin/users')->assertOk()
            ->assertJsonFragment(['id' => $student->id])
            ->assertJsonFragment(['id' => $tutor->id]);

        $response = $this->getJson("/api/admin/users/{$tutor->id}")->assertOk()
            ->assertJsonPath('data.faculty_or_university', 'Example Faculty')
            ->assertJsonPath('data.study_program', 'Computer Science')
            ->assertJsonPath('data.roles.0', 'student')
            ->assertJsonPath('data.is_approved_tutor', true)
            ->assertJsonPath('data.tutor_profile.biography', 'Tutor profile biography.')
            ->assertJsonPath('data.tutor_profile.offerings.0.subject.name', 'Physics')
            ->assertJsonCount(2, 'data.tutor_profile.availability')
            ->assertJsonPath('data.tutor_profile.availability.0.id', $pastAvailability->id)
            ->assertJsonPath('data.tutor_profile.availability.1.id', $availability->id)
            ->assertJsonMissing(['email' => $tutor->email])
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.tutor_profile.offerings.1')
            ->assertJsonMissingPath('data.tutor_applications')
            ->assertJsonMissingPath('data.transcript_path');

        $this->assertStringNotContainsString($tutor->email, $response->getContent());
    }

    public function test_only_admin_can_access_user_management_and_unauthenticated_users_are_rejected(): void
    {
        $student = $this->userWithRoles(Role::STUDENT);
        $tutor = $this->approvedTutor();

        $this->getJson('/api/admin/users')->assertUnauthorized();
        $this->actingAs($student)->getJson('/api/admin/users')->assertForbidden();
        $this->getJson("/api/admin/users/{$tutor->id}")->assertForbidden();
        $this->actingAs($tutor)->getJson('/api/admin/users')->assertForbidden();
        $this->getJson("/api/admin/users/{$student->id}")->assertForbidden();
    }

    public function test_admin_profile_update_rejects_role_changes(): void
    {
        $admin = $this->userWithRoles(Role::ADMIN);
        $student = $this->userWithRoles(Role::STUDENT);
        $before = $student->only(['name', 'faculty_or_university', 'study_program']);

        $this->actingAs($admin)->patchJson("/api/admin/users/{$student->id}", [
            'name' => 'Changed by admin',
            'roles' => [Role::ADMIN],
        ])->assertUnprocessable();

        $this->assertSame($before, $student->fresh()->only(['name', 'faculty_or_university', 'study_program']));
        $this->assertTrue($student->fresh()->hasRole(Role::STUDENT));
        $this->assertFalse($student->fresh()->hasRole(Role::ADMIN));
    }

    public function test_admin_can_update_only_permitted_profile_fields(): void
    {
        $admin = $this->userWithRoles(Role::ADMIN);
        $student = $this->userWithRoles(Role::STUDENT);

        $this->actingAs($admin)->patchJson("/api/admin/users/{$student->id}", [
            'first_name' => 'Updated',
            'last_name' => 'Learner',
            'faculty_or_university' => 'Arts Faculty',
            'study_program' => 'History',
            'year_of_study' => 3,
            'biography' => 'Updated biography.',
        ])->assertOk()
            ->assertJsonPath('data.name', 'Updated Learner')
            ->assertJsonPath('data.faculty_or_university', 'Arts Faculty')
            ->assertJsonMissingPath('data.email')
            ->assertJsonMissingPath('data.password');

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'name' => 'Updated Learner',
            'year_of_study' => 3,
        ]);
        $this->assertTrue($student->fresh()->hasRole(Role::STUDENT));

        $this->actingAs($admin)->patchJson("/api/admin/users/{$student->id}", [
            'first_name' => 'Updated',
            'last_name' => 'Learner',
            'roles' => [Role::ADMIN],
            'is_approved_tutor' => true,
        ])->assertUnprocessable();
        $this->assertFalse($student->fresh()->hasRole(Role::ADMIN));
        $this->assertFalse($student->fresh()->hasRole(Role::TUTOR));
    }

    public function test_admin_profile_update_validates_fields_and_cannot_edit_own_profile_or_status(): void
    {
        $admin = $this->userWithRoles(Role::ADMIN, Role::STUDENT);
        $student = $this->userWithRoles(Role::STUDENT);

        $this->actingAs($admin)->patchJson("/api/admin/users/{$student->id}", [
            'first_name' => str_repeat('a', 101),
            'last_name' => 'Learner',
        ])->assertUnprocessable()->assertJsonValidationErrors('first_name');

        $this->actingAs($admin)->patchJson("/api/admin/users/{$admin->id}", [
            'first_name' => 'Changed',
            'last_name' => 'Admin',
        ])->assertForbidden();
        $this->actingAs($admin)->patchJson("/api/admin/users/{$admin->id}/status", [
            'is_active' => false,
        ])->assertForbidden();
    }

    public function test_only_admin_can_edit_or_change_account_status(): void
    {
        $student = $this->userWithRoles(Role::STUDENT);
        $tutor = $this->approvedTutor();
        $target = $this->userWithRoles(Role::STUDENT);

        foreach ([$student, $tutor] as $nonAdmin) {
            $this->actingAs($nonAdmin)->patchJson("/api/admin/users/{$target->id}", [
                'first_name' => 'Changed',
                'last_name' => 'Name',
            ])->assertForbidden();
            $this->actingAs($nonAdmin)->patchJson("/api/admin/users/{$target->id}/status", [
                'is_active' => false,
            ])->assertForbidden();
        }
    }

    public function test_admin_can_deactivate_and_reactivate_account_without_deleting_history(): void
    {
        $admin = $this->userWithRoles(Role::ADMIN);
        $student = $this->userWithRoles(Role::STUDENT);
        $application = $student->tutorApplications()->create(['motivation' => 'Application history.']);

        $this->actingAs($admin)->patchJson("/api/admin/users/{$student->id}/status", [
            'is_active' => false,
        ])->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('users', ['id' => $student->id, 'is_active' => false]);
        $this->assertDatabaseHas('tutor_applications', ['id' => $application->id, 'user_id' => $student->id]);

        $this->actingAs($admin)->patchJson("/api/admin/users/{$student->id}/status", [
            'is_active' => true,
        ])->assertOk()->assertJsonPath('data.is_active', true);
        $this->assertDatabaseHas('users', ['id' => $student->id, 'is_active' => true]);
    }

    public function test_account_status_requires_a_boolean(): void
    {
        $admin = $this->userWithRoles(Role::ADMIN);
        $student = $this->userWithRoles(Role::STUDENT);

        $this->actingAs($admin)->patchJson("/api/admin/users/{$student->id}/status", [
            'is_active' => 'inactive',
        ])->assertUnprocessable()->assertJsonValidationErrors('is_active');

    }
}
