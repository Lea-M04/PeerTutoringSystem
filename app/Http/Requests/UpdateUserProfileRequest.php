<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'faculty_or_university' => ['nullable', 'string', 'max:180'],
            'study_program' => ['nullable', 'string', 'max:180'],
            'biography' => ['nullable', 'string', 'max:1200'],
            'id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'email' => ['prohibited'],
            'password' => ['prohibited'],
            'role' => ['prohibited'],
            'roles' => ['prohibited'],
        ];
    }
}
