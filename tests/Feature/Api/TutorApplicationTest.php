<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TutorApplicationTest extends TestCase
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
        $user->roles()->attach(Role::query()->where('name', $role)->firstOrFail());

        return $user;
    }

    public function test_unauthenticated_users_cannot_access_protected_api(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_student_can_submit_valid_application_and_view_history(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $subject = Subject::factory()->create();
        $this->actingAs($student)->postJson('/api/tutor-applications', [
            'motivation' => 'I have extensive experience helping classmates understand mathematics.',
            'subject_ids' => [$subject->id],
        ])->assertCreated()->assertJsonPath('data.status', 'pending');
        $this->actingAs($student)->getJson('/api/tutor-applications')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.motivation', 'I have extensive experience helping classmates understand mathematics.')
            ->assertJsonPath('data.0.subjects.0.id', $subject->id);
        $this->assertDatabaseHas('tutor_applications', [
            'user_id' => $student->id,
            'motivation' => 'I have extensive experience helping classmates understand mathematics.',
            'status' => TutorApplication::PENDING,
        ]);
        $this->assertFalse($student->fresh()->hasRole(Role::TUTOR));
    }

    public function test_missing_motivation_or_subjects_is_rejected(): void
    {
        $this->actingAs($this->userWithRole(Role::STUDENT))->postJson('/api/tutor-applications', [])->assertUnprocessable();
    }

    public function test_inactive_subject_cannot_be_proposed(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $subject = Subject::factory()->create(['is_active' => false]);
        $this->actingAs($student)->postJson('/api/tutor-applications', [
            'motivation' => 'I have extensive experience helping classmates understand mathematics.',
            'subject_ids' => [$subject->id],
        ])->assertUnprocessable();
    }

    public function test_non_student_cannot_submit_application(): void
    {
        $user = User::factory()->create();
        $subject = Subject::factory()->create();
        $this->actingAs($user)->postJson('/api/tutor-applications', [
            'motivation' => 'I have extensive experience helping classmates understand mathematics.',
            'subject_ids' => [$subject->id],
        ])->assertForbidden();
    }

    public function test_second_pending_application_is_rejected_and_reapplication_after_rejection_is_allowed(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $subject = Subject::factory()->create();
        $payload = ['motivation' => 'I have extensive experience helping classmates understand mathematics.', 'subject_ids' => [$subject->id]];
        $this->actingAs($student)->postJson('/api/tutor-applications', $payload)->assertCreated();
        $this->actingAs($student)->postJson('/api/tutor-applications', $payload)->assertUnprocessable();
        $previousApplication = TutorApplication::query()->firstOrFail();
        $previousApplication->forceFill(['status' => TutorApplication::REJECTED, 'rejection_reason' => 'Please provide more detail.'])->save();
        $this->actingAs($student)->postJson('/api/tutor-applications', $payload)->assertCreated();
        $this->assertDatabaseCount('tutor_applications', 2);
        $this->actingAs($student)->getJson('/api/tutor-applications')->assertOk()->assertJsonCount(2, 'data');
        $this->assertDatabaseHas('tutor_applications', ['id' => $previousApplication->id, 'status' => TutorApplication::REJECTED]);
        $this->assertFalse($student->fresh()->hasRole(Role::TUTOR));
    }

    public function test_admin_approval_retains_student_role_and_repeat_review_is_rejected(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $admin = $this->userWithRole(Role::ADMIN);
        $application = TutorApplication::factory()->for($student, 'applicant')->create();
        $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$application->id}/approve")->assertOk();
        $this->assertTrue($student->fresh()->hasRole(Role::STUDENT));
        $this->assertTrue($student->fresh()->hasRole(Role::TUTOR));
        $this->assertDatabaseHas('tutor_profiles', ['user_id' => $student->id]);
        $this->actingAs($student)->getJson('/api/tutor-applications')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$application->id}/approve")->assertUnprocessable();
    }

    public function test_admin_cannot_review_their_own_tutor_application(): void
    {
        $adminApplicant = $this->userWithRole(Role::ADMIN);
        $application = TutorApplication::factory()->for($adminApplicant, 'applicant')->create();

        $this->actingAs($adminApplicant)
            ->postJson("/api/admin/tutor-applications/{$application->id}/approve")
            ->assertForbidden();
        $this->actingAs($adminApplicant)
            ->postJson("/api/admin/tutor-applications/{$application->id}/reject", ['reason' => 'A sufficiently detailed reason.'])
            ->assertForbidden();
        $this->assertDatabaseHas('tutor_applications', ['id' => $application->id, 'status' => TutorApplication::PENDING]);
    }

    public function test_only_admin_can_list_pending_tutor_applications(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $tutor = $this->userWithRole(Role::TUTOR);
        $admin = $this->userWithRole(Role::ADMIN);
        $application = TutorApplication::factory()->for($student, 'applicant')->create();

        $this->getJson('/api/admin/tutor-applications')->assertUnauthorized();
        $this->actingAs($student)->getJson('/api/admin/tutor-applications')->assertForbidden();
        $this->actingAs($tutor)->getJson('/api/admin/tutor-applications')->assertForbidden();
        $this->actingAs($admin)->getJson('/api/admin/tutor-applications')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $application->id);
    }

    public function test_rejection_is_saved_with_reason_and_cannot_be_repeated(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $admin = $this->userWithRole(Role::ADMIN);
        $application = TutorApplication::factory()->for($student, 'applicant')->create();
        $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$application->id}/reject", ['reason' => 'Please add more subject experience.'])
            ->assertOk()->assertJsonPath('data.status', TutorApplication::REJECTED);
        $this->assertFalse($student->fresh()->hasRole(Role::TUTOR));
        $this->assertDatabaseMissing('tutor_profiles', ['user_id' => $student->id]);
        $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$application->id}/reject", ['reason' => 'Second review attempt.'])
            ->assertUnprocessable();
    }

    public function test_non_admin_cannot_review_and_rejection_requires_reason(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $application = TutorApplication::factory()->for($student, 'applicant')->create();
        $this->actingAs($student)->postJson("/api/admin/tutor-applications/{$application->id}/approve")->assertForbidden();
        $admin = $this->userWithRole(Role::ADMIN);
        $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$application->id}/reject", [])->assertUnprocessable();
    }

    public function test_student_cannot_review_own_or_another_users_application(): void
    {
        $owner = $this->userWithRole(Role::STUDENT);
        $other = $this->userWithRole(Role::STUDENT);
        $application = TutorApplication::factory()->for($owner, 'applicant')->create();
        $this->actingAs($owner)->postJson("/api/admin/tutor-applications/{$application->id}/approve")->assertForbidden();
        $this->actingAs($other)->postJson("/api/admin/tutor-applications/{$application->id}/approve")->assertForbidden();
    }

    public function test_approval_rolls_back_status_when_role_grant_fails(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $admin = $this->userWithRole(Role::ADMIN);
        $application = TutorApplication::factory()->for($student, 'applicant')->create();
        DB::statement("CREATE TRIGGER fail_tutor_role BEFORE INSERT ON role_user WHEN NEW.role_id = (SELECT id FROM roles WHERE name = 'tutor') BEGIN SELECT RAISE(ABORT, 'simulated role insert failure'); END");
        try {
            $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$application->id}/approve")->assertServerError();
        } finally {
            DB::statement('DROP TRIGGER IF EXISTS fail_tutor_role');
        }
        $this->assertDatabaseHas('tutor_applications', ['id' => $application->id, 'status' => TutorApplication::PENDING, 'reviewer_id' => null]);
        $this->assertFalse($student->fresh()->hasRole(Role::TUTOR));
        $this->assertDatabaseMissing('tutor_profiles', ['user_id' => $student->id]);
    }
}
