<?php

namespace App\Policies;

use App\Models\Booking;
use App\Models\Review;
use App\Models\Role;
use App\Models\User;

class ReviewPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::TUTOR) && $user->tutorProfile()->exists();
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Review $review): bool
    {
        return false;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user, Booking $booking): bool
    {
        return $user->hasRole(Role::STUDENT)
            && ! $user->hasRole(Role::ADMIN)
            && (int) $booking->student_id === (int) $user->getKey()
            && $booking->status === Booking::COMPLETED
            && (int) $booking->tutorProfile?->user_id !== (int) $user->getKey();
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Review $review): bool
    {
        return false;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Review $review): bool
    {
        return false;
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, Review $review): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, Review $review): bool
    {
        return false;
    }
}
