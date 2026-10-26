<?php

namespace Tests\Feature\Auth;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_assigns_only_student_role_and_does_not_expose_password(): void
    {
        $this->seed(RoleSeeder::class);
        $this->postJson('/register', [
            'name' => 'Test Student', 'email' => 'student@example.test',
            'password' => 'A-long-random-test-password', 'password_confirmation' => 'A-long-random-test-password',
            'roles' => ['admin'],
        ])->assertUnprocessable();

        $this->postJson('/register', [
            'name' => 'Test Student', 'email' => 'student@example.test',
            'password' => 'A-long-random-test-password', 'password_confirmation' => 'A-long-random-test-password',
        ])->assertCreated()->assertJsonMissingPath('data.password');
        $this->assertDatabaseHas('role_user', [
            'user_id' => 1,
            'role_id' => Role::query()->where('name', Role::STUDENT)->value('id'),
        ]);
    }

    public function test_logout_requires_authentication(): void
    {
        $this->postJson('/logout')->assertUnauthorized();
    }

    public function test_existing_accounts_default_to_active(): void
    {
        $user = User::factory()->create();

        $this->assertTrue($user->fresh()->is_active);
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'is_active' => true,
        ]);
    }

    public function test_inactive_users_cannot_log_in(): void
    {
        $user = User::factory()->create([
            'email' => 'inactive@example.test',
            'password' => Hash::make('correct-password'),
            'is_active' => false,
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'correct-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_active_users_can_still_log_in_and_access_the_api(): void
    {
        $user = User::factory()->create([
            'email' => 'active@example.test',
            'password' => Hash::make('correct-password'),
            'is_active' => true,
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'correct-password',
        ])->assertOk()->assertJsonPath('data.id', $user->id);

        $this->getJson('/api/user')->assertOk()->assertJsonPath('data.id', $user->id);
    }

    public function test_deactivated_authenticated_user_cannot_use_protected_api_endpoints(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $this->actingAs($user);
        User::query()->whereKey($user->id)->update(['is_active' => false]);

        $this->getJson('/api/user')
            ->assertForbidden()
            ->assertJsonPath('message', 'This account is inactive. Contact an administrator for assistance.');
    }
}
