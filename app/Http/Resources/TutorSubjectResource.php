<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TutorSubjectResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $isActive = (bool) $this->subject?->is_active;
        if ($this->relationLoaded('tutorProfile') && $this->tutorProfile !== null) {
            $isActive = $isActive && (bool) $this->tutorProfile->user?->is_active;
        }

        return [
            'id' => $this->id,
            'description' => $this->description,
            'is_active' => $isActive,
            'subject' => [
                'id' => $this->subject->id,
                'name' => $this->subject->name,
                'is_active' => (bool) $this->subject->is_active,
            ],
            'tutor' => $this->whenLoaded('tutorProfile', fn (): array => [
                'id' => $this->tutorProfile->id,
                'name' => $this->tutorProfile->user->name,
                'is_active' => (bool) $this->tutorProfile->user->is_active,
            ]),
        ];
    }
}
