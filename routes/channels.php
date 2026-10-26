<?php

use App\Models\Conversation;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('conversations.{conversation}', function (User $user, Conversation $conversation): bool {
    return $user->is_active && $user->can('view', $conversation);
});

Broadcast::channel('users.{userId}.chat', function (User $user, string $userId): bool {
    $canUseChat = ($user->hasRole(Role::STUDENT)
        && ! $user->hasRole(Role::TUTOR)
        && ! $user->hasRole(Role::ADMIN)) || $user->isApprovedTutor();

    return $user->is_active && $canUseChat && (string) $user->getKey() === $userId;
});
