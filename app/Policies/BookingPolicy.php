<?php

namespace App\Policies;

use App\Models\Booking;
use App\Models\Role;
use App\Models\User;

class BookingPolicy
{
    public function viewAdminAny(User $user): bool
    {
        return $user->hasRole(Role::ADMIN);
    }

    public function viewAdmin(User $user, Booking $booking): bool
    {
        return $user->hasRole(Role::ADMIN);
    }

    public function viewStudentBookings(User $user): bool
    {
        return $this->isStudent($user);
    }

    public function create(User $user): bool
    {
        return $this->isStudent($user);
    }

    public function viewAsStudent(User $user, Booking $booking): bool
    {
        return $this->isStudent($user) && $booking->student_id === $user->getKey();
    }

    public function cancelAsStudent(User $user, Booking $booking): bool
    {
        return $this->viewAsStudent($user, $booking);
    }

    public function viewTutorBookings(User $user): bool
    {
        return $this->isApprovedTutor($user);
    }

    public function viewAsTutor(User $user, Booking $booking): bool
    {
        return $this->ownsBooking($user, $booking);
    }

    public function accept(User $user, Booking $booking): bool
    {
        return $this->ownsBooking($user, $booking);
    }

    public function reject(User $user, Booking $booking): bool
    {
        return $this->ownsBooking($user, $booking);
    }

    public function complete(User $user, Booking $booking): bool
    {
        return $this->ownsBooking($user, $booking);
    }

    private function isStudent(User $user): bool
    {
        return $user->hasRole(Role::STUDENT) && ! $user->hasRole(Role::ADMIN);
    }

    private function ownsBooking(User $user, Booking $booking): bool
    {
        return $this->isApprovedTutor($user)
            && $booking->tutor_profile_id === $user->tutorProfile?->getKey();
    }

    private function isApprovedTutor(User $user): bool
    {
        return $user->isApprovedTutor();
    }
}
