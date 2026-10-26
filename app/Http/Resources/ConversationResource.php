<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'student' => $this->whenLoaded('student', fn (): array => [
                'id' => $this->student->id,
                'name' => $this->student->name,
                'first_name' => $this->student->first_name,
                'last_name' => $this->student->last_name,
            ]),
            'tutor' => $this->whenLoaded('tutorProfile', fn (): array => [
                'profile_id' => $this->tutorProfile->id,
                'user_id' => $this->tutorProfile->user->id,
                'name' => $this->tutorProfile->user->name,
                'first_name' => $this->tutorProfile->user->first_name,
                'last_name' => $this->tutorProfile->user->last_name,
            ]),
            'latest_message' => MessageResource::make($this->whenLoaded('latestMessage')),
            'unread_count' => (int) ($this->unread_count ?? 0),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
