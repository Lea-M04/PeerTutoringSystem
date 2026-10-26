<?php

namespace App\Http\Resources;

use App\Models\Role;
use App\Models\TutorApplication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $isApprovedTutor = $this->whenLoaded('roles', fn (): bool =>
            $this->roles->contains('name', Role::TUTOR)
            && $this->tutorApplications()->where('status', TutorApplication::APPROVED)->exists());

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'faculty_or_university' => $this->faculty_or_university,
            'study_program' => $this->study_program,
            'year_of_study' => $this->year_of_study,
            'biography' => $this->biography,
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')->values()),
            'is_approved_tutor' => $isApprovedTutor,
        ];
    }
}
