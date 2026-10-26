<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AdminUpdateUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'faculty_or_university' => ['nullable', 'string', 'max:180'],
            'study_program' => ['nullable', 'string', 'max:180'],
            'year_of_study' => ['nullable', 'integer', 'min:1', 'max:32767'],
            'biography' => ['nullable', 'string', 'max:1200'],
            'id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'email' => ['prohibited'],
            'password' => ['prohibited'],
            'role' => ['prohibited'],
            'roles' => ['prohibited'],
            'is_active' => ['prohibited'],
            'is_approved_tutor' => ['prohibited'],
            'tutor_profile' => ['prohibited'],
            'transcript_path' => ['prohibited'],
        ];
    }
}
