<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
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
            'status' => $this->status,
            'starts_at' => $this->starts_at?->utc()->toISOString(),
            'ends_at' => $this->ends_at?->utc()->toISOString(),
            'subject' => $this->whenLoaded('subject', fn (): ?array => $this->subject === null ? null : [
                'id' => $this->subject->id,
                'name' => $this->subject->name,
            ]),
            'created_at' => $this->created_at?->toISOString(),
            'student' => $this->whenLoaded('student', fn (): array => [
                'id' => $this->student->id,
                'name' => $this->student->name,
                'first_name' => $this->student->first_name,
                'last_name' => $this->student->last_name,
            ]),
            'tutor' => $this->whenLoaded('tutorProfile', fn (): array => [
                'id' => $this->tutorProfile->id,
                'name' => $this->tutorProfile->user->name,
                'first_name' => $this->tutorProfile->user->first_name,
                'last_name' => $this->tutorProfile->user->last_name,
            ]),
            'review' => ReviewResource::make($this->whenLoaded('review')),
        ];
    }
}
