<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\InAppNotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class NotificationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return InAppNotificationResource::collection(
            $request->user()->inAppNotifications()
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->paginate(15),
        );
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'unread_count' => $request->user()->inAppNotifications()->whereNull('read_at')->count(),
            ],
        ]);
    }

    public function markRead(Request $request, string $notification): InAppNotificationResource
    {
        $ownedNotification = $request->user()->inAppNotifications()->whereKey($notification)->firstOrFail();

        if ($ownedNotification->read_at === null) {
            $ownedNotification->forceFill(['read_at' => now()])->save();
        }

        return InAppNotificationResource::make($ownedNotification->refresh());
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $timestamp = now();
        $updatedCount = $request->user()->inAppNotifications()
            ->whereNull('read_at')
            ->update(['read_at' => $timestamp, 'updated_at' => $timestamp]);

        return response()->json([
            'data' => [
                'marked_read' => $updatedCount,
            ],
        ]);
    }
}
