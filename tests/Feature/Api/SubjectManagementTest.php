<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\Subject;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SubjectManagementTest extends TestCase
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

    public function test_only_admins_can_access_subject_management_endpoints(): void
    {
        $subject = Subject::factory()->create();

        $this->getJson('/api/admin/subjects')->assertUnauthorized();
        $this->postJson('/api/admin/subjects', ['name' => 'Physics'])->assertUnauthorized();
        $this->patchJson("/api/admin/subjects/{$subject->id}", ['name' => 'Physics'])->assertUnauthorized();
        $this->patchJson("/api/admin/subjects/{$subject->id}/status", ['is_active' => false])->assertUnauthorized();

        foreach ([Role::STUDENT, Role::TUTOR] as $role) {
            $user = $this->userWithRole($role);
            $this->actingAs($user)->getJson('/api/admin/subjects')->assertForbidden();
            $this->actingAs($user)->postJson('/api/admin/subjects', ['name' => "New {$role} subject"])->assertForbidden();
            $this->actingAs($user)->patchJson("/api/admin/subjects/{$subject->id}", [
                'name' => "Changed by {$role}",
                'description' => 'Unauthorized update attempt.',
            ])->assertForbidden();
            $this->actingAs($user)->patchJson("/api/admin/subjects/{$subject->id}/status", ['is_active' => false])->assertForbidden();
        }
    }

    public function test_admin_can_list_all_subjects_and_create_a_subject(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $active = Subject::factory()->create(['name' => 'Biology', 'description' => 'Life sciences']);
        $inactive = Subject::factory()->create(['name' => 'Chemistry', 'is_active' => false]);

        $this->actingAs($admin)->getJson('/api/admin/subjects')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['id' => $active->id, 'name' => 'Biology', 'description' => 'Life sciences', 'is_active' => true])
            ->assertJsonFragment(['id' => $inactive->id, 'name' => 'Chemistry', 'is_active' => false]);

        $this->actingAs($admin)->postJson('/api/admin/subjects', [
            'name' => '  Physics  ',
            'description' => 'Mechanics, matter, and energy.',
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Physics')
            ->assertJsonPath('data.description', 'Mechanics, matter, and energy.')
            ->assertJsonPath('data.is_active', true);

        $this->assertDatabaseHas('subjects', [
            'name' => 'Physics',
            'description' => 'Mechanics, matter, and energy.',
            'is_active' => true,
        ]);
    }

    public function test_duplicate_subject_names_are_rejected(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $existing = Subject::factory()->create(['name' => 'Mathematics']);
        $other = Subject::factory()->create(['name' => 'Physics']);

        $this->actingAs($admin)->postJson('/api/admin/subjects', ['name' => 'Mathematics'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->actingAs($admin)->patchJson("/api/admin/subjects/{$other->id}", [
            'name' => 'Mathematics',
            'description' => null,
        ])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->assertDatabaseHas('subjects', ['id' => $existing->id, 'name' => 'Mathematics']);
        $this->assertDatabaseHas('subjects', ['id' => $other->id, 'name' => 'Physics']);
    }

    public function test_admin_can_edit_subject_name_and_description(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $subject = Subject::factory()->create(['name' => 'Maths', 'description' => null]);

        $this->actingAs($admin)->patchJson("/api/admin/subjects/{$subject->id}", [
            'name' => 'Mathematics',
            'description' => 'Core mathematical concepts.',
        ])->assertOk()
            ->assertJsonPath('data.name', 'Mathematics')
            ->assertJsonPath('data.description', 'Core mathematical concepts.');

        $this->assertDatabaseHas('subjects', [
            'id' => $subject->id,
            'name' => 'Mathematics',
            'description' => 'Core mathematical concepts.',
        ]);
    }

    public function test_admin_can_activate_or_deactivate_subjects_and_application_list_only_includes_active_subjects(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $active = Subject::factory()->create(['name' => 'Active subject']);
        $inactive = Subject::factory()->create(['name' => 'Inactive subject', 'is_active' => false]);

        $this->actingAs($admin)->getJson('/api/subjects')
            ->assertOk()
            ->assertJsonFragment(['id' => $active->id, 'name' => 'Active subject'])
            ->assertJsonMissing(['id' => $inactive->id, 'name' => 'Inactive subject']);
        $student = $this->userWithRole(Role::STUDENT);
        $this->actingAs($student)->getJson('/api/subjects')
            ->assertOk()
            ->assertJsonFragment(['id' => $active->id, 'name' => 'Active subject'])
            ->assertJsonMissing(['id' => $inactive->id, 'name' => 'Inactive subject']);

        $this->actingAs($admin)->patchJson("/api/admin/subjects/{$active->id}/status", ['is_active' => false])
            ->assertOk()->assertJsonPath('data.is_active', false);
        $this->actingAs($admin)->getJson('/api/subjects')->assertJsonMissing(['id' => $active->id, 'name' => 'Active subject']);

        $this->actingAs($admin)->patchJson("/api/admin/subjects/{$inactive->id}/status", ['is_active' => true])
            ->assertOk()->assertJsonPath('data.is_active', true);
        $this->actingAs($admin)->getJson('/api/subjects')->assertJsonFragment(['id' => $inactive->id, 'name' => 'Inactive subject']);

        $this->assertDatabaseHas('subjects', ['id' => $active->id, 'is_active' => false]);
        $this->assertDatabaseHas('subjects', ['id' => $inactive->id, 'is_active' => true]);
    }
}
