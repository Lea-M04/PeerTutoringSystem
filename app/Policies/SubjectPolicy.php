<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\Subject;
use App\Models\User;

class SubjectPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::ADMIN);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Role::ADMIN);
    }

    public function update(User $user, Subject $subject): bool
    {
        return $user->hasRole(Role::ADMIN);
    }

    public function delete(User $user, Subject $subject): bool
    {
        return $user->hasRole(Role::ADMIN);
    }
}
