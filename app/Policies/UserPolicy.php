<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

class UserPolicy
{
    public function viewAdminOverview(User $user): bool
    {
        return $user->hasRole(Role::ADMIN);
    }

    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::ADMIN);
    }

    public function view(User $user, User $profiledUser): bool
    {
        return $user->hasRole(Role::ADMIN);
    }

    public function update(User $user, User $profiledUser): bool
    {
        return $user->hasRole(Role::ADMIN) && $user->isNot($profiledUser);
    }

    public function updateStatus(User $user, User $profiledUser): bool
    {
        return $user->hasRole(Role::ADMIN) && $user->isNot($profiledUser);
    }
}
