<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\TutorProfile;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function userWithRoles(string ...$roles): User
    {
        $user = User::factory()->create();
        $roleIds = Role::query()->whereIn('name', $roles)->pluck('id');
        $user->roles()->attach($roleIds);

        return $user;
    }

    public function test_guest_cannot_view_or_update_a_user_profile(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
        $this->patchJson('/api/user', [])->assertUnauthorized();
        $this->getJson('/api/tutor-profile')->assertUnauthorized();
        $this->patchJson('/api/tutor-profile', [])->assertUnauthorized();
    }

    public function test_authenticated_user_can_view_their_profile_without_sensitive_fields(): void
    {
        $user = $this->userWithRoles(Role::STUDENT);

        $this->actingAs($user)->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.name', $user->name)
            ->assertJsonPath('data.email', $user->email)
            ->assertJsonPath('data.first_name', null)
            ->assertJsonPath('data.roles.0', Role::STUDENT)
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.remember_token');
    }

    public function test_authenticated_user_can_update_only_their_editable_profile_fields(): void
    {
        $user = $this->userWithRoles(Role::STUDENT);

        $this->actingAs($user)->patchJson('/api/user', [
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'faculty_or_university' => 'Faculty of Science',
            'study_program' => 'Computer Science',
            'biography' => 'I enjoy collaborative problem solving.',
        ])->assertOk()
            ->assertJsonPath('data.first_name', 'Ada')
            ->assertJsonPath('data.last_name', 'Lovelace')
            ->assertJsonPath('data.name', 'Ada Lovelace')
            ->assertJsonPath('data.faculty_or_university', 'Faculty of Science')
            ->assertJsonPath('data.study_program', 'Computer Science')
            ->assertJsonPath('data.biography', 'I enjoy collaborative problem solving.');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Ada Lovelace',
            'email' => $user->email,
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'faculty_or_university' => 'Faculty of Science',
            'study_program' => 'Computer Science',
            'biography' => 'I enjoy collaborative problem solving.',
        ]);

        $this->actingAs($user)->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.first_name', 'Ada')
            ->assertJsonPath('data.last_name', 'Lovelace')
            ->assertJsonPath('data.faculty_or_university', 'Faculty of Science')
            ->assertJsonPath('data.study_program', 'Computer Science')
            ->assertJsonPath('data.biography', 'I enjoy collaborative problem solving.');
    }

    public function test_invalid_profile_input_is_rejected(): void
    {
        $user = $this->userWithRoles(Role::STUDENT);

        $this->actingAs($user)->patchJson('/api/user', [
            'first_name' => str_repeat('A', 101),
            'last_name' => '',
            'faculty_or_university' => str_repeat('F', 181),
            'study_program' => ['not', 'a', 'string'],
            'biography' => str_repeat('B', 1201),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name', 'last_name', 'faculty_or_university', 'study_program', 'biography']);
    }

    public function test_profile_update_cannot_target_another_user_or_change_email_or_roles(): void
    {
        $user = $this->userWithRoles(Role::STUDENT);
        $otherUser = $this->userWithRoles(Role::STUDENT);

        $this->actingAs($user)->patchJson('/api/user', [
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'user_id' => $otherUser->id,
            'email' => 'changed@example.test',
            'roles' => [Role::ADMIN],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['user_id', 'email', 'roles']);
        $this->actingAs($user)->patchJson("/api/user/{$otherUser->id}", [
            'first_name' => 'Changed',
            'last_name' => 'Elsewhere',
        ])->assertNotFound();

        $this->assertDatabaseHas('users', ['id' => $otherUser->id, 'email' => $otherUser->email]);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'email' => $user->email]);
        $this->assertFalse($user->fresh()->hasRole(Role::ADMIN));
    }

    public function test_only_a_tutor_can_view_or_update_their_tutor_profile(): void
    {
        $student = $this->userWithRoles(Role::STUDENT);
        $this->actingAs($student)->getJson('/api/tutor-profile')->assertForbidden();
        $this->actingAs($student)->patchJson('/api/tutor-profile', ['biography' => 'I help students learn.'])->assertForbidden();
        $administrator = $this->userWithRoles(Role::ADMIN);
        $this->actingAs($administrator)->getJson('/api/tutor-profile')->assertForbidden();

        $tutor = $this->userWithRoles(Role::STUDENT, Role::TUTOR);
        $this->actingAs($tutor)->getJson('/api/tutor-profile')
            ->assertOk()
            ->assertJsonPath('data.biography', null);
        $this->actingAs($tutor)->patchJson('/api/tutor-profile', [
            'biography' => 'I help students break challenging topics into manageable steps.',
        ])->assertCreated()->assertJsonPath('data.biography', 'I help students break challenging topics into manageable steps.');

        $this->assertDatabaseHas('tutor_profiles', [
            'user_id' => $tutor->id,
            'biography' => 'I help students break challenging topics into manageable steps.',
        ]);
        $this->assertDatabaseMissing('tutor_profiles', ['user_id' => $student->id]);
    }

    public function test_tutor_profile_rejects_another_users_id_and_invalid_biography(): void
    {
        $tutor = $this->userWithRoles(Role::STUDENT, Role::TUTOR);
        $otherTutor = $this->userWithRoles(Role::STUDENT, Role::TUTOR);

        $this->actingAs($tutor)->patchJson('/api/tutor-profile', [
            'biography' => str_repeat('B', 1201),
            'user_id' => $otherTutor->id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['biography', 'user_id']);

        $this->assertNull(TutorProfile::query()->where('user_id', $otherTutor->id)->first());
    }
}
