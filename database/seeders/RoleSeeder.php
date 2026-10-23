<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach ([Role::STUDENT, Role::TUTOR, Role::ADMIN] as $name) {
            Role::query()->firstOrCreate(['name' => $name]);
        }
    }
}
