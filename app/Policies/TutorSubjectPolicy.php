<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\TutorSubject;
use App\Models\User;

class TutorSubjectPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::TUTOR)
            && $user->tutorProfile()->exists()
            && $user->tutorApplications()->where('status', TutorApplication::APPROVED)->exists();
    }

    public function update(User $user, TutorSubject $tutorSubject): bool
    {
        return $this->ownsApprovedTutorProfile($user, $tutorSubject);
    }

    public function delete(User $user, TutorSubject $tutorSubject): bool
    {
        return $this->ownsApprovedTutorProfile($user, $tutorSubject);
    }

    private function ownsApprovedTutorProfile(User $user, TutorSubject $tutorSubject): bool
    {
        return $user->hasRole(Role::TUTOR)
            && $tutorSubject->tutorProfile()->where('user_id', $user->getKey())->exists()
            && $user->tutorApplications()->where('status', TutorApplication::APPROVED)->exists();
    }
}
