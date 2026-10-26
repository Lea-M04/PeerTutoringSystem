<?php

namespace App\Http\Controllers\Api;

use App\Events\Chat\MessageCreated;
use App\Events\Chat\ReadReceiptUpdated;
use App\Events\Chat\UnreadCountUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\MarkConversationReadRequest;
use App\Http\Requests\StoreMessageRequest;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\ChatImageProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class ConversationMessageController extends Controller
{
    public function index(Request $request, Conversation $conversation): AnonymousResourceCollection
    {
        Gate::authorize('view', $conversation);

        return MessageResource::collection(
            $conversation->messages()
                ->with(['sender:id,name,first_name,last_name', 'attachments'])
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->cursorPaginate(30),
        );
    }

    public function store(
        StoreMessageRequest $request,
        Conversation $conversation,
        ChatImageProcessor $imageProcessor,
    ): JsonResponse {
        $sender = $request->user();
        $clientMessageId = $request->validated('client_message_id');
        $existingMessage = $this->findByIdempotencyKey($conversation, (int) $sender->getKey(), $clientMessageId);

        if ($existingMessage !== null) {
            return MessageResource::make($existingMessage)
                ->response()
                ->setStatusCode(200);
        }

        $preparedImage = $request->hasFile('attachment')
            ? $imageProcessor->process($request->file('attachment'))
            : null;
        $storagePath = $preparedImage === null
            ? null
            : 'chat/'.$conversation->getKey().'/'.Str::uuid().'.'.$preparedImage['extension'];

        if ($preparedImage !== null
            && ! Storage::disk('private')->put($storagePath, $preparedImage['contents'], ['visibility' => 'private'])) {
            throw ValidationException::withMessages([
                'attachment' => 'The image could not be stored. Please try again.',
            ]);
        }

        try {
            $message = DB::transaction(function () use ($conversation, $sender, $clientMessageId, $request, $preparedImage, $storagePath): Message {
                $message = $conversation->messages()->create([
                    'sender_id' => $sender->getKey(),
                    'client_message_id' => $clientMessageId,
                    'body' => trim((string) $request->validated('body')) !== ''
                        ? trim((string) $request->validated('body'))
                        : null,
                ]);

                if ($preparedImage !== null && $storagePath !== null) {
                    $message->attachments()->create([
                        'storage_disk' => 'private',
                        'storage_path' => $storagePath,
                        'mime_type' => $preparedImage['mime_type'],
                        'size_bytes' => $preparedImage['size_bytes'],
                        'width' => $preparedImage['width'],
                        'height' => $preparedImage['height'],
                    ]);
                }

                $conversation->touch();

                return $message;
            });
        } catch (Throwable $exception) {
            if ($storagePath !== null) {
                Storage::disk('private')->delete($storagePath);
            }

            $existingMessage = $this->findByIdempotencyKey($conversation, (int) $sender->getKey(), $clientMessageId);
            if ($existingMessage !== null) {
                return MessageResource::make($existingMessage)
                    ->response()
                    ->setStatusCode(200);
            }

            throw $exception;
        }

        $messageResource = MessageResource::make($message->load(['sender:id,name,first_name,last_name', 'attachments']));
        $recipientId = (int) $conversation->student_id === (int) $sender->getKey()
            ? (int) $conversation->tutorProfile()->value('user_id')
            : (int) $conversation->student_id;

        event(new MessageCreated((int) $conversation->getKey(), $messageResource->resolve($request)));
        event(new UnreadCountUpdated($recipientId, (int) $conversation->getKey()));

        return $messageResource
            ->response()
            ->setStatusCode(201);
    }

    public function markRead(MarkConversationReadRequest $request, Conversation $conversation): JsonResponse
    {
        $targetMessage = $conversation->messages()
            ->whereKey($request->validated('message_id'))
            ->firstOrFail();

        if ((int) $targetMessage->sender_id === (int) $request->user()->getKey()) {
            throw ValidationException::withMessages([
                'message_id' => 'Read receipts can only be advanced through a message received from the other participant.',
            ]);
        }

        $readAt = now();
        $markedRead = DB::transaction(fn (): int => $conversation->messages()
            ->where('sender_id', '!=', $request->user()->getKey())
            ->whereNull('read_at')
            ->where(function ($messages) use ($targetMessage): void {
                $messages->where('created_at', '<', $targetMessage->created_at)
                    ->orWhere(function ($sameTimestamp) use ($targetMessage): void {
                        $sameTimestamp->where('created_at', $targetMessage->created_at)
                            ->where('id', '<=', $targetMessage->getKey());
                    });
            })
            ->update(['read_at' => $readAt, 'updated_at' => $readAt]));

        if ($markedRead > 0) {
            $readerId = (int) $request->user()->getKey();
            event(new ReadReceiptUpdated(
                (int) $conversation->getKey(),
                $readerId,
                (int) $targetMessage->getKey(),
                $readAt->toISOString(),
            ));
            event(new UnreadCountUpdated($readerId, (int) $conversation->getKey()));
        }

        return response()->json([
            'data' => [
                'marked_read' => $markedRead,
                'read_through_message_id' => $targetMessage->getKey(),
                'read_at' => $readAt->toISOString(),
            ],
        ]);
    }

    private function findByIdempotencyKey(Conversation $conversation, int $senderId, string $clientMessageId): ?Message
    {
        return $conversation->messages()
            ->where('sender_id', $senderId)
            ->where('client_message_id', $clientMessageId)
            ->with(['sender:id,name,first_name,last_name', 'attachments'])
            ->first();
    }
}
