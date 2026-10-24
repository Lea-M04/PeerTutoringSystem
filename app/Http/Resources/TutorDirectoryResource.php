<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TutorDirectoryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'biography' => $this->biography,
            'user' => [
                'first_name' => $this->user->first_name,
                'last_name' => $this->user->last_name,
                'name' => $this->user->name,
                'faculty_or_university' => $this->user->faculty_or_university,
                'study_program' => $this->user->study_program,
                'year_of_study' => $this->user->year_of_study,
            ],
            'offerings' => TutorSubjectResource::collection($this->whenLoaded('offerings')),
        ];
    }
}
