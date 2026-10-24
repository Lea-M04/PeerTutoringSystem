<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTutorSubjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('tutorSubject')) ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'subject_id' => ['sometimes', 'required', 'integer', Rule::exists('subjects', 'id')->where('is_active', true)],
            'description' => ['sometimes', 'nullable', 'string', 'max:1200'],
            'user_id' => ['prohibited'],
            'tutor_profile_id' => ['prohibited'],
        ];
    }
}
