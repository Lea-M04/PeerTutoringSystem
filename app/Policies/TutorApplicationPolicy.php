<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\User;

class TutorApplicationPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::ADMIN);
    }

    public function viewAnyOwn(User $user): bool
    {
        return $user->hasRole(Role::STUDENT);
    }

    public function review(User $user, ?TutorApplication $tutorApplication = null): bool
    {
        return $user->hasRole(Role::ADMIN)
            && ($tutorApplication === null || $user->id !== $tutorApplication->user_id);
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, TutorApplication $tutorApplication): bool
    {
        return $user->id === $tutorApplication->user_id || $user->hasRole(Role::ADMIN);
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->hasRole(Role::STUDENT);
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, TutorApplication $tutorApplication): bool
    {
        return false;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, TutorApplication $tutorApplication): bool
    {
        return false;
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, TutorApplication $tutorApplication): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, TutorApplication $tutorApplication): bool
    {
        return false;
    }
}
