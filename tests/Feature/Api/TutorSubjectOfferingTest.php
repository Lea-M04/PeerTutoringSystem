<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TutorSubjectOfferingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function approvedTutor(): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $user->roles()->attach(Role::query()->where('name', Role::TUTOR)->value('id'));
        $user->tutorProfile()->create([]);
        $application = $user->tutorApplications()->create(['motivation' => 'I enjoy helping peers.']);
        $application->forceFill(['status' => TutorApplication::APPROVED])->save();

        return $user->fresh();
    }

    public function test_approved_tutor_can_create_list_update_and_delete_their_offerings(): void
    {
        $tutor = $this->approvedTutor();
        $subject = Subject::factory()->create(['name' => 'Statistics']);

        $created = $this->actingAs($tutor)->postJson('/api/tutor-profile/offerings', [
            'subject_id' => $subject->id, 'description' => 'Introductory statistics and data analysis.',
        ])->assertCreated()->assertJsonPath('data.subject.id', $subject->id)->assertJsonPath('data.description', 'Introductory statistics and data analysis.');
        $offeringId = $created->json('data.id');
        $this->assertDatabaseHas('tutor_subjects', ['id' => $offeringId, 'tutor_profile_id' => $tutor->tutorProfile->id, 'subject_id' => $subject->id]);

        $this->getJson('/api/tutor-profile/offerings')->assertOk()->assertJsonPath('data.0.subject.name', 'Statistics');
        $this->patchJson("/api/tutor-profile/offerings/{$offeringId}", ['description' => 'Data analysis and probability.'])
            ->assertOk()->assertJsonPath('data.description', 'Data analysis and probability.');
        $this->deleteJson("/api/tutor-profile/offerings/{$offeringId}")->assertNoContent();
        $this->assertDatabaseMissing('tutor_subjects', ['id' => $offeringId]);
    }

    public function test_students_and_unapproved_tutors_cannot_manage_offerings(): void
    {
        $student = User::factory()->create();
        $student->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $subject = Subject::factory()->create();
        $this->actingAs($student)->getJson('/api/tutor-profile/offerings')->assertForbidden();
        $this->actingAs($student)->postJson('/api/tutor-profile/offerings', ['subject_id' => $subject->id])->assertForbidden();

        $unapproved = User::factory()->create();
        $unapproved->roles()->attach(Role::query()->where('name', Role::TUTOR)->value('id'));
        $unapproved->tutorProfile()->create([]);
        $this->actingAs($unapproved)->postJson('/api/tutor-profile/offerings', ['subject_id' => $subject->id])->assertForbidden();
    }

    public function test_tutor_cannot_edit_another_tutors_offering(): void
    {
        $owner = $this->approvedTutor();
        $other = $this->approvedTutor();
        $subject = Subject::factory()->create();
        $offering = $owner->tutorProfile->offerings()->create(['subject_id' => $subject->id]);

        $this->actingAs($other)->patchJson("/api/tutor-profile/offerings/{$offering->id}", ['description' => 'Take over'])
            ->assertForbidden();
        $this->actingAs($other)->deleteJson("/api/tutor-profile/offerings/{$offering->id}")->assertForbidden();
        $this->assertDatabaseHas('tutor_subjects', ['id' => $offering->id, 'description' => null]);
    }

    public function test_inactive_or_nonexistent_subjects_and_duplicate_offerings_are_rejected(): void
    {
        $tutor = $this->approvedTutor();
        $inactive = Subject::factory()->create(['is_active' => false]);
        $this->actingAs($tutor)->postJson('/api/tutor-profile/offerings', ['subject_id' => $inactive->id])
            ->assertUnprocessable()->assertJsonValidationErrors('subject_id');
        $this->actingAs($tutor)->postJson('/api/tutor-profile/offerings', ['subject_id' => 999999])
            ->assertUnprocessable()->assertJsonValidationErrors('subject_id');

        $active = Subject::factory()->create();
        $this->actingAs($tutor)->postJson('/api/tutor-profile/offerings', ['subject_id' => $active->id])->assertCreated();
        $this->actingAs($tutor)->postJson('/api/tutor-profile/offerings', ['subject_id' => $active->id])
            ->assertUnprocessable()->assertJsonValidationErrors('subject_id');
        $another = Subject::factory()->create();
        $anotherOffering = $tutor->tutorProfile->offerings()->create(['subject_id' => $another->id]);
        $firstOffering = $tutor->tutorProfile->offerings()->where('subject_id', $active->id)->firstOrFail();
        $this->actingAs($tutor)->patchJson("/api/tutor-profile/offerings/{$firstOffering->id}", ['subject_id' => $another->id])
            ->assertUnprocessable()->assertJsonValidationErrors('subject_id');
        $this->assertDatabaseCount('tutor_subjects', 2);
        $this->assertDatabaseHas('tutor_subjects', ['id' => $anotherOffering->id, 'subject_id' => $another->id]);
    }

    public function test_student_directory_contains_only_approved_tutors_and_active_offerings_without_email(): void
    {
        $student = User::factory()->create();
        $student->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $tutor = $this->approvedTutor();
        $active = Subject::factory()->create(['name' => 'Active subject']);
        $inactive = Subject::factory()->create(['name' => 'Inactive subject', 'is_active' => false]);
        $tutor->tutorProfile->offerings()->create(['subject_id' => $active->id, 'description' => 'Peer learning']);
        $tutor->tutorProfile->offerings()->create(['subject_id' => $inactive->id]);

        $this->actingAs($student)->getJson('/api/tutors')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.offerings.0.subject.name', 'Active subject')
            ->assertJsonMissingPath('data.0.user.email');
    }

    public function test_directory_excludes_the_authenticated_student_tutor_but_keeps_other_eligible_tutors(): void
    {
        $currentTutor = $this->approvedTutor();
        $otherTutor = $this->approvedTutor();
        $subject = Subject::factory()->create();
        $currentTutor->tutorProfile->offerings()->create(['subject_id' => $subject->id]);
        $otherTutor->tutorProfile->offerings()->create(['subject_id' => $subject->id]);

        $this->actingAs($currentTutor)->getJson('/api/tutors')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $otherTutor->tutorProfile->id);
    }

    public function test_student_cannot_open_their_own_tutor_profile_from_the_directory(): void
    {
        $currentTutor = $this->approvedTutor();
        $subject = Subject::factory()->create();
        $currentTutor->tutorProfile->offerings()->create(['subject_id' => $subject->id]);

        $this->actingAs($currentTutor)->getJson("/api/tutors/{$currentTutor->tutorProfile->id}")->assertNotFound();
    }

    public function test_directory_excludes_approved_tutors_without_active_offerings(): void
    {
        $student = User::factory()->create();
        $student->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $tutor = $this->approvedTutor();
        $inactive = Subject::factory()->create(['is_active' => false]);
        $tutor->tutorProfile->offerings()->create(['subject_id' => $inactive->id]);

        $this->actingAs($student)->getJson('/api/tutors')->assertOk()->assertExactJson(['data' => []]);
    }

    public function test_tutor_directory_requires_an_authenticated_student(): void
    {
        $this->getJson('/api/tutors')->assertUnauthorized();

        $tutorOnly = User::factory()->create();
        $tutorOnly->roles()->attach(Role::query()->where('name', Role::TUTOR)->value('id'));
        $this->actingAs($tutorOnly)->getJson('/api/tutors')->assertForbidden();
    }

    public function test_student_can_open_a_directory_profile_without_private_email(): void
    {
        $student = User::factory()->create();
        $student->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $tutor = $this->approvedTutor();
        $tutor->forceFill([
            'first_name' => 'Grace',
            'last_name' => 'Hopper',
            'faculty_or_university' => 'Engineering Faculty',
            'study_program' => 'Computer Science',
            'year_of_study' => 3,
        ])->save();
        $tutor->tutorProfile->update(['biography' => 'I enjoy explaining programming concepts.']);
        $subject = Subject::factory()->create(['name' => 'Programming']);
        $tutor->tutorProfile->offerings()->create(['subject_id' => $subject->id, 'description' => 'Foundations and debugging.']);

        $this->actingAs($student)->getJson("/api/tutors/{$tutor->tutorProfile->id}")->assertOk()
            ->assertJsonPath('data.user.first_name', 'Grace')
            ->assertJsonPath('data.user.last_name', 'Hopper')
            ->assertJsonPath('data.user.faculty_or_university', 'Engineering Faculty')
            ->assertJsonPath('data.user.study_program', 'Computer Science')
            ->assertJsonPath('data.user.year_of_study', 3)
            ->assertJsonPath('data.biography', 'I enjoy explaining programming concepts.')
            ->assertJsonPath('data.offerings.0.subject.name', 'Programming')
            ->assertJsonPath('data.offerings.0.description', 'Foundations and debugging.')
            ->assertJsonMissingPath('data.user.email');
    }

    public function test_student_cannot_open_a_tutor_profile_that_is_not_in_the_directory(): void
    {
        $student = User::factory()->create();
        $student->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $unapproved = User::factory()->create();
        $unapproved->roles()->attach(Role::query()->where('name', Role::TUTOR)->value('id'));
        $profile = $unapproved->tutorProfile()->create([]);

        $this->actingAs($student)->getJson("/api/tutors/{$profile->id}")->assertNotFound();
    }
}
