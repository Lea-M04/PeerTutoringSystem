<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\Role;
use App\Models\User;

class ConversationPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->isStudent($user) || $user->isApprovedTutor();
    }

    public function view(User $user, Conversation $conversation): bool
    {
        return ($this->isStudent($user) && $conversation->student_id === $user->getKey())
            || ($user->isApprovedTutor() && $conversation->tutor_profile_id === $user->tutorProfile?->getKey());
    }

    public function create(User $user): bool
    {
        return $this->isStudent($user);
    }

    public function sendMessage(User $user, Conversation $conversation): bool
    {
        return $this->view($user, $conversation);
    }

    public function markRead(User $user, Conversation $conversation): bool
    {
        return $this->view($user, $conversation);
    }

    private function isStudent(User $user): bool
    {
        return $user->hasRole(Role::STUDENT)
            && ! $user->hasRole(Role::ADMIN);
    }
}
