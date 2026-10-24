<?php

namespace App\Http\Requests;

use App\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTutorSubjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user?->hasRole(Role::TUTOR)
            && $user->tutorProfile()->exists()
            && $user->tutorApplications()->where('status', 'approved')->exists();
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'subject_id' => ['required', 'integer', Rule::exists('subjects', 'id')->where('is_active', true)],
            'description' => ['nullable', 'string', 'max:1200'],
            'user_id' => ['prohibited'],
            'tutor_profile_id' => ['prohibited'],
        ];
    }
}
