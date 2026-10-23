<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class InitialAdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $email = config('peer_tutoring.initial_admin.email');
        $password = config('peer_tutoring.initial_admin.password');

        if (! is_string($email) || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new RuntimeException('Set a valid INITIAL_ADMIN_EMAIL in the local environment before provisioning the initial admin.');
        }

        if (! is_string($password) || mb_strlen($password) < 16) {
            throw new RuntimeException('Set INITIAL_ADMIN_PASSWORD to a unique password of at least 16 characters before provisioning the initial admin.');
        }

        $this->call(RoleSeeder::class);

        DB::transaction(function () use ($email, $password): void {
            $adminRole = Role::query()->where('name', Role::ADMIN)->firstOrFail();
            $existingUser = User::query()->where('email', $email)->first();

            if ($existingUser !== null) {
                if (! $existingUser->roles()->where('name', Role::ADMIN)->exists()) {
                    throw new RuntimeException('The configured initial admin email already belongs to a non-admin account. No role changes were made.');
                }

                return;
            }

            $admin = User::query()->create([
                'name' => 'Initial Administrator',
                'email' => $email,
                'password' => Hash::make($password),
            ]);

            $admin->roles()->attach($adminRole);
        });
    }
}
