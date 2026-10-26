<?php

namespace App\Events\Chat;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Queue\SerializesModels;

class UnreadCountUpdated implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use SerializesModels;

    public function __construct(public int $userId, public int $conversationId) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('users.'.$this->userId.'.chat')];
    }

    public function broadcastAs(): string
    {
        return 'chat.unread-count.updated';
    }

    /**
     * @return array{conversation_id: int}
     */
    public function broadcastWith(): array
    {
        return ['conversation_id' => $this->conversationId];
    }
}
