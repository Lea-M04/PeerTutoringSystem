<?php

namespace App\Events\Chat;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Queue\SerializesModels;

class MessageCreated implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $message
     */
    public function __construct(public int $conversationId, public array $message) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('conversations.'.$this->conversationId)];
    }

    public function broadcastAs(): string
    {
        return 'chat.message.created';
    }

    /**
     * @return array{conversation_id: int, message: array<string, mixed>}
     */
    public function broadcastWith(): array
    {
        return ['conversation_id' => $this->conversationId, 'message' => $this->message];
    }
}
