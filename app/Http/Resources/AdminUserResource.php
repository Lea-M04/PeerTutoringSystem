<?php

namespace App\Http\Resources;

use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminUserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $roles = $this->whenLoaded('roles', fn () => $this->roles->pluck('name')->values());
        $isApprovedTutor = $this->has_approved_tutor_application
            && $this->roles->contains('name', Role::TUTOR);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'faculty_or_university' => $this->faculty_or_university,
            'study_program' => $this->study_program,
            'year_of_study' => $this->year_of_study,
            'biography' => $this->biography,
            'is_active' => (bool) $this->is_active,
            'roles' => $roles,
            'is_approved_tutor' => $isApprovedTutor,
            'tutor_profile' => $this->whenLoaded('tutorProfile', function () {
                return $this->tutorProfile
                    ? AdminTutorProfileResource::make($this->tutorProfile)
                    : null;
            }),
        ];
    }
}
