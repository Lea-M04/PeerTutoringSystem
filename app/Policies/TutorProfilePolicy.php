<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

class TutorProfilePolicy
{
    public function manageOwn(User $user): bool
    {
        return $user->hasRole(Role::TUTOR);
    }
}
