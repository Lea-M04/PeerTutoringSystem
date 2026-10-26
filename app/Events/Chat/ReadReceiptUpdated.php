<?php

namespace App\Events\Chat;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Queue\SerializesModels;

class ReadReceiptUpdated implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use SerializesModels;

    public function __construct(
        public int $conversationId,
        public int $readerId,
        public int $readThroughMessageId,
        public string $readAt,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('conversations.'.$this->conversationId)];
    }

    public function broadcastAs(): string
    {
        return 'chat.read-receipt.updated';
    }

    /**
     * @return array{conversation_id: int, reader_id: int, read_through_message_id: int, read_at: string}
     */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'reader_id' => $this->readerId,
            'read_through_message_id' => $this->readThroughMessageId,
            'read_at' => $this->readAt,
        ];
    }
}
