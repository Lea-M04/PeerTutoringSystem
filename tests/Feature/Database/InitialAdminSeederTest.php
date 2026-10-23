<?php

namespace Tests\Feature\Database;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\InitialAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class InitialAdminSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_does_not_promote_an_existing_ordinary_user(): void
    {
        $user = User::factory()->create(['email' => 'existing@example.test']);
        $user->roles()->attach(Role::query()->create(['name' => Role::STUDENT]));
        Role::query()->create(['name' => Role::TUTOR]);
        config(['peer_tutoring.initial_admin.email' => 'existing@example.test']);
        config(['peer_tutoring.initial_admin.password' => 'a-random-test-password-long-enough']);

        try {
            $this->seed(InitialAdminSeeder::class);
            $this->fail('Expected the seeder to refuse promotion.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('already belongs to a non-admin', $exception->getMessage());
        }

        $this->assertFalse($user->fresh()->hasRole(Role::ADMIN));
    }

    public function test_seeder_fails_without_valid_configuration_without_disclosing_values(): void
    {
        config(['peer_tutoring.initial_admin.email' => null]);
        config(['peer_tutoring.initial_admin.password' => null]);

        $this->expectException(RuntimeException::class);
        $this->seed(InitialAdminSeeder::class);
    }
}
