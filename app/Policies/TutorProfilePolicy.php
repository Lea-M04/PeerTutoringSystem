<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\TutorProfile;
use App\Models\User;

class TutorProfilePolicy
{
    public function manageOwn(User $user): bool
    {
        return $user->hasRole(Role::TUTOR);
    }

    public function startConversation(User $user, TutorProfile $tutorProfile): bool
    {
        return $user->hasRole(Role::STUDENT)
            && ! $user->hasRole(Role::TUTOR)
            && ! $user->hasRole(Role::ADMIN)
            && $tutorProfile->user_id !== $user->getKey()
            && $tutorProfile->user?->is_active === true
            && $tutorProfile->user->isApprovedTutor();
    }
}
