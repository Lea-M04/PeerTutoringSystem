<?php

namespace Tests\Feature\Auth;

use App\Models\Role;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
