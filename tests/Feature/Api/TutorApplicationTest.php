<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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

    private function validApplicationData(Subject $subject): array
    {
        return [
            'motivation' => 'I have extensive experience helping classmates understand mathematics.',
            'faculty_or_university' => 'Faculty of Science',
            'study_program' => 'Computer Science',
            'year_of_study' => '2',
            'subject_ids' => [$subject->id],
            'transcript' => UploadedFile::fake()->createWithContent('academic-record.pdf', "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"),
        ];
    }

    public function test_unauthenticated_users_cannot_access_protected_api(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_student_can_submit_valid_application_and_view_history(): void
    {
        Storage::fake('private');
        $student = $this->userWithRole(Role::STUDENT);
        $subject = Subject::factory()->create();
        $this->actingAs($student)->withHeader('Accept', 'application/json')->post('/api/tutor-applications', $this->validApplicationData($subject))
            ->assertCreated()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.transcript_available', true)->assertJsonMissingPath('data.transcript_path');
        $this->actingAs($student)->getJson('/api/tutor-applications')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.motivation', 'I have extensive experience helping classmates understand mathematics.')
            ->assertJsonPath('data.0.subjects.0.id', $subject->id);
        $this->assertDatabaseHas('tutor_applications', [
            'user_id' => $student->id,
            'motivation' => 'I have extensive experience helping classmates understand mathematics.',
            'status' => TutorApplication::PENDING,
        ]);
        $application = TutorApplication::query()->where('user_id', $student->id)->firstOrFail();
        $this->assertDatabaseHas('users', ['id' => $student->id, 'faculty_or_university' => 'Faculty of Science', 'study_program' => 'Computer Science', 'year_of_study' => 2]);
        $this->assertStringStartsWith('tutor-applications/'.$application->id.'/', $application->transcript_path);
        Storage::disk('private')->assertExists($application->transcript_path);
        $this->assertFalse($student->fresh()->hasRole(Role::TUTOR));
    }

    public function test_transcript_is_required_for_a_new_application(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $subject = Subject::factory()->create();
        $payload = $this->validApplicationData($subject);
        unset($payload['transcript']);

        $this->actingAs($student)->withHeader('Accept', 'application/json')->post('/api/tutor-applications', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors(['transcript']);
    }

    public function test_non_pdf_transcript_is_rejected(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $subject = Subject::factory()->create();
        $payload = $this->validApplicationData($subject);
        $payload['transcript'] = UploadedFile::fake()->createWithContent('academic-record.txt', 'not a PDF document');

        $this->actingAs($student)->withHeader('Accept', 'application/json')->post('/api/tutor-applications', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors(['transcript']);
    }

    public function test_transcript_larger_than_configured_limit_is_rejected(): void
    {
        config(['peer_tutoring.tutor_application.transcript_max_kb' => 1]);
        $student = $this->userWithRole(Role::STUDENT);
        $subject = Subject::factory()->create();
        $payload = $this->validApplicationData($subject);
        $payload['transcript'] = UploadedFile::fake()->create('academic-record.pdf', 2, 'application/pdf');

        $this->actingAs($student)->withHeader('Accept', 'application/json')->post('/api/tutor-applications', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors(['transcript']);
    }

    public function test_only_an_admin_can_download_an_applicant_transcript(): void
    {
        Storage::fake('private');
        Storage::fake('public');
        $this->getJson('/api/admin/tutor-applications/1/transcript')->assertUnauthorized();
        $student = $this->userWithRole(Role::STUDENT);
        $anotherStudent = $this->userWithRole(Role::STUDENT);
        $admin = $this->userWithRole(Role::ADMIN);
        $tutor = $this->userWithRole(Role::TUTOR);
        $subject = Subject::factory()->create();
        $payload = $this->validApplicationData($subject);
        $contents = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF";
        $payload['transcript'] = UploadedFile::fake()->createWithContent('ignored-original-name.pdf', $contents);

        $created = $this->actingAs($student)->withHeader('Accept', 'application/json')->post('/api/tutor-applications', $payload)->assertCreated();
        $applicationId = $created->json('data.id');
        $path = TutorApplication::query()->findOrFail($applicationId)->transcript_path;
        Storage::disk('public')->assertMissing($path);

        $this->actingAs($student)->getJson("/api/admin/tutor-applications/{$applicationId}/transcript")->assertForbidden();
        $this->actingAs($anotherStudent)->getJson("/api/admin/tutor-applications/{$applicationId}/transcript")->assertForbidden();
        $this->actingAs($tutor)->getJson("/api/admin/tutor-applications/{$applicationId}/transcript")->assertForbidden();
        $this->actingAs($admin)->get("/api/admin/tutor-applications/{$applicationId}/transcript")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertStreamedContent($contents);
    }

    public function test_missing_motivation_or_subjects_is_rejected(): void
    {
        $this->actingAs($this->userWithRole(Role::STUDENT))->postJson('/api/tutor-applications', [])->assertUnprocessable();
    }

    public function test_inactive_subject_cannot_be_proposed(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $subject = Subject::factory()->create(['is_active' => false]);
        $payload = $this->validApplicationData($subject);
        $this->actingAs($student)->withHeader('Accept', 'application/json')->post('/api/tutor-applications', $payload)->assertUnprocessable();
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

    public function test_approved_tutor_cannot_submit_another_tutor_application(): void
    {
        $approvedStudent = $this->userWithRole(Role::STUDENT);
        $approvedStudent->roles()->attach(Role::query()->where('name', Role::TUTOR)->firstOrFail());
        $subject = Subject::factory()->create();

        $this->actingAs($approvedStudent)->postJson('/api/tutor-applications', $this->validApplicationData($subject))
            ->assertForbidden();
    }

    public function test_second_pending_application_is_rejected_and_reapplication_after_rejection_is_allowed(): void
    {
        Storage::fake('private');
        $student = $this->userWithRole(Role::STUDENT);
        $subject = Subject::factory()->create();
        $payload = $this->validApplicationData($subject);
        $this->actingAs($student)->withHeader('Accept', 'application/json')->post('/api/tutor-applications', $payload)->assertCreated();
        $this->actingAs($student)->withHeader('Accept', 'application/json')->post('/api/tutor-applications', $this->validApplicationData($subject))->assertUnprocessable();
        $previousApplication = TutorApplication::query()->firstOrFail();
        $previousTranscriptPath = $previousApplication->transcript_path;
        $previousApplication->forceFill(['status' => TutorApplication::REJECTED, 'rejection_reason' => 'Please provide more detail.'])->save();
        $this->actingAs($student)->withHeader('Accept', 'application/json')->post('/api/tutor-applications', $this->validApplicationData($subject))->assertCreated();
        $this->assertDatabaseCount('tutor_applications', 2);
        $this->actingAs($student)->getJson('/api/tutor-applications')->assertOk()->assertJsonCount(2, 'data');
        $this->assertDatabaseHas('tutor_applications', ['id' => $previousApplication->id, 'status' => TutorApplication::REJECTED]);
        Storage::disk('private')->assertExists($previousTranscriptPath);
        $newApplication = TutorApplication::query()->where('status', TutorApplication::PENDING)->firstOrFail();
        $this->assertNotSame($previousTranscriptPath, $newApplication->transcript_path);
        Storage::disk('private')->assertExists($newApplication->transcript_path);
        $this->actingAs($student)->getJson('/api/tutor-applications')->assertOk()
            ->assertJsonPath('data.1.status', TutorApplication::REJECTED)
            ->assertJsonPath('data.1.rejection_reason', 'Please provide more detail.');
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
        $this->actingAs($student)->getJson('/api/tutor-applications')->assertJsonPath('data.0.status', TutorApplication::APPROVED);
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
        $student->forceFill([
            'faculty_or_university' => 'Faculty of Science',
            'study_program' => 'Mathematics',
            'year_of_study' => 3,
        ])->save();
        $application = TutorApplication::factory()->for($student, 'applicant')->create();

        $this->getJson('/api/admin/tutor-applications')->assertUnauthorized();
        $this->actingAs($student)->getJson('/api/admin/tutor-applications')->assertForbidden();
        $this->actingAs($tutor)->getJson('/api/admin/tutor-applications')->assertForbidden();
        $this->actingAs($admin)->getJson('/api/admin/tutor-applications')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $application->id)
            ->assertJsonPath('data.0.applicant.faculty_or_university', 'Faculty of Science')
            ->assertJsonPath('data.0.applicant.study_program', 'Mathematics')
            ->assertJsonPath('data.0.applicant.year_of_study', 3)
            ->assertJsonPath('data.0.transcript_available', false);
    }

    public function test_rejection_is_saved_with_reason_and_cannot_be_repeated(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $admin = $this->userWithRole(Role::ADMIN);
        $application = TutorApplication::factory()->for($student, 'applicant')->create();
        $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$application->id}/reject", ['reason' => 'Please add more subject experience.'])
            ->assertOk()->assertJsonPath('data.status', TutorApplication::REJECTED)
            ->assertJsonPath('data.rejection_reason', 'Please add more subject experience.');
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

    public function test_rejection_reason_must_be_meaningful(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $admin = $this->userWithRole(Role::ADMIN);
        $application = TutorApplication::factory()->for($student, 'applicant')->create();

        $this->actingAs($admin)->postJson("/api/admin/tutor-applications/{$application->id}/reject", ['reason' => 'Too short'])
            ->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->assertDatabaseHas('tutor_applications', ['id' => $application->id, 'status' => TutorApplication::PENDING]);
    }

    public function test_latest_application_history_is_returned_first_for_dashboard_status(): void
    {
        $student = $this->userWithRole(Role::STUDENT);
        $newer = TutorApplication::factory()->for($student, 'applicant')->create([
            'status' => TutorApplication::PENDING,
            'created_at' => now()->addSecond(),
        ]);
        TutorApplication::factory()->for($student, 'applicant')->create([
            'status' => TutorApplication::REJECTED,
            'rejection_reason' => 'Please add more academic information.',
            'created_at' => now(),
        ]);

        $this->actingAs($student)->getJson('/api/tutor-applications')->assertOk()
            ->assertJsonPath('data.0.id', $newer->id)
            ->assertJsonPath('data.0.status', TutorApplication::PENDING);
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
