<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TutorApplicationResource extends JsonResource
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
            'motivation' => $this->motivation,
            'status' => $this->status,
            'rejection_reason' => $this->rejection_reason,
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'transcript_available' => $this->transcript_path !== null,
            'subjects' => $this->whenLoaded('subjects', fn () => $this->subjects->map(fn ($subject) => ['id' => $subject->id, 'name' => $subject->name])->values()),
            'applicant' => $this->whenLoaded('applicant', fn () => [
                'id' => $this->applicant->id,
                'name' => $this->applicant->name,
                'email' => $this->applicant->email,
                'faculty_or_university' => $this->applicant->faculty_or_university,
                'study_program' => $this->applicant->study_program,
                'year_of_study' => $this->applicant->year_of_study,
            ]),
        ];
    }
}
