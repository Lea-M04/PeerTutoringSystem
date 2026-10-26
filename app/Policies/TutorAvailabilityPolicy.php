<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\TutorAvailability;
use App\Models\User;

class TutorAvailabilityPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->isApprovedTutor($user);
    }

    public function create(User $user): bool
    {
        return $this->isApprovedTutor($user);
    }

    public function update(User $user, TutorAvailability $availability): bool
    {
        return $this->ownsAvailability($user, $availability);
    }

    public function delete(User $user, TutorAvailability $availability): bool
    {
        return $this->ownsAvailability($user, $availability);
    }

    private function ownsAvailability(User $user, TutorAvailability $availability): bool
    {
        return $this->isApprovedTutor($user)
            && $availability->tutorProfile()->where('user_id', $user->getKey())->exists();
    }

    private function isApprovedTutor(User $user): bool
    {
        return $user->hasRole(Role::TUTOR)
            && ! $user->hasRole(Role::ADMIN)
            && $user->tutorProfile()->exists()
            && $user->tutorApplications()->where('status', TutorApplication::APPROVED)->exists();
    }
}
