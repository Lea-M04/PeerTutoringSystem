<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreConversationRequest;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\TutorProfile;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ConversationController extends Controller
{
    public function unreadCount(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Conversation::class);

        $user = $request->user();
        $conversations = Conversation::query();

        if ($user->isApprovedTutor()) {
            $conversations->where('tutor_profile_id', $user->tutorProfile->getKey());
        } else {
            $conversations->where('student_id', $user->getKey());
        }

        $unreadCount = Message::query()
            ->whereIn('conversation_id', $conversations->select('id'))
            ->where('sender_id', '!=', $user->getKey())
            ->whereNull('read_at')
            ->count();

        return response()->json(['data' => ['unread_count' => $unreadCount]]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Conversation::class);

        $user = $request->user();
        $query = Conversation::query()
            ->with([
                'student:id,name,first_name,last_name',
                'tutorProfile.user:id,name,first_name,last_name',
                'latestMessage.sender:id,name,first_name,last_name',
                'latestMessage.attachments',
            ])
            ->withCount(['messages as unread_count' => fn ($messages) => $messages
                ->where('sender_id', '!=', $user->getKey())
                ->whereNull('read_at')]);

        if ($user->isApprovedTutor()) {
            $query->where('tutor_profile_id', $user->tutorProfile->getKey());
        } else {
            $query->where('student_id', $user->getKey());
        }

        return ConversationResource::collection(
            $query->orderByDesc('updated_at')->orderByDesc('id')->paginate(20),
        );
    }

    public function store(StoreConversationRequest $request): JsonResponse
    {
        $tutorProfile = TutorProfile::query()
            ->with('user')
            ->findOrFail($request->validated('tutor_profile_id'));
        Gate::authorize('startConversation', $tutorProfile);

        try {
            $conversation = DB::transaction(fn (): Conversation => Conversation::query()->firstOrCreate([
                'student_id' => $request->user()->getKey(),
                'tutor_profile_id' => $tutorProfile->getKey(),
            ]));
        } catch (QueryException $exception) {
            $conversation = Conversation::query()
                ->where('student_id', $request->user()->getKey())
                ->where('tutor_profile_id', $tutorProfile->getKey())
                ->first();

            if ($conversation === null) {
                throw $exception;
            }
        }

        $created = $conversation->wasRecentlyCreated;
        $conversation->load([
            'student:id,name,first_name,last_name',
            'tutorProfile.user:id,name,first_name,last_name',
            'latestMessage.sender:id,name,first_name,last_name',
            'latestMessage.attachments',
        ])->loadCount(['messages as unread_count' => fn ($messages) => $messages
            ->where('sender_id', '!=', $request->user()->getKey())
            ->whereNull('read_at')]);

        return ConversationResource::make($conversation)
            ->response()
            ->setStatusCode($created ? 201 : 200);
    }
}
