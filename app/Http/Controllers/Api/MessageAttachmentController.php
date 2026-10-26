<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MessageAttachment;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MessageAttachmentController extends Controller
{
    public function show(MessageAttachment $attachment): StreamedResponse
    {
        $attachment->loadMissing('message.conversation');
        $conversation = $attachment->message?->conversation;

        abort_if($conversation === null || $attachment->storage_disk !== 'private', 404);
        Gate::authorize('view', $conversation);

        $disk = Storage::disk('private');
        abort_unless($disk->exists($attachment->storage_path), 404);
        $stream = $disk->readStream($attachment->storage_path);
        abort_if($stream === false, 404);

        return response()->stream(function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        }, 200, [
            'Content-Type' => $attachment->mime_type,
            'Content-Length' => (string) $attachment->size_bytes,
            'Content-Disposition' => 'inline',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ]);
    }
}
