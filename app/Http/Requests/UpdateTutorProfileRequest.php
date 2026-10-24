<?php

namespace App\Http\Requests;

use App\Models\Role;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTutorProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole(Role::TUTOR) ?? false;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'biography' => ['nullable', 'string', 'max:1200'],
            'user_id' => ['prohibited'],
            'id' => ['prohibited'],
        ];
    }
}
