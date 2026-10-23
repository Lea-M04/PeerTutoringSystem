<?php

namespace App\Http\Requests;

use App\Models\Role;
use App\Models\Subject;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreTutorApplicationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->hasRole(Role::STUDENT) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'motivation' => ['required', 'string', 'min:20', 'max:5000'],
            'subject_ids' => ['required', 'array', 'min:1', 'max:20'],
            'subject_ids.*' => ['required', 'integer', 'distinct', 'exists:subjects,id'],
            'user_id' => ['prohibited'],
            'reviewer_id' => ['prohibited'],
            'status' => ['prohibited'],
            'rejection_reason' => ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $ids = $this->input('subject_ids', []);
            if (is_array($ids) && count($ids) > 0 && count($ids) === count(array_unique($ids))) {
                $activeCount = Subject::query()->whereIn('id', $ids)->where('is_active', true)->count();
                if ($activeCount !== count($ids)) {
                    $validator->errors()->add('subject_ids', 'Every proposed subject must be active.');
                }
            }
        });
    }
}
