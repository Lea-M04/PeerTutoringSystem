<?php

namespace App\Http\Requests;

use App\Models\Role;
use App\Models\Subject;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Validator;

class StoreTutorApplicationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && $user->hasRole(Role::STUDENT)
            && ! $user->hasRole(Role::TUTOR)
            && ! $user->hasRole(Role::ADMIN);
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
            'faculty_or_university' => ['required', 'string', 'max:180'],
            'study_program' => ['required', 'string', 'max:180'],
            'year_of_study' => ['required', 'integer', 'min:1', 'max:32767'],
            'transcript' => ['required', 'file', 'mimes:pdf', 'mimetypes:application/pdf', 'max:'.(int) config('peer_tutoring.tutor_application.transcript_max_kb', 10240)],
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
            if (! $validator->errors()->has('transcript')) {
                $transcript = $this->file('transcript');
                $realPath = $transcript instanceof UploadedFile ? $transcript->getRealPath() : false;
                $stream = $transcript instanceof UploadedFile && $transcript->isValid() && $realPath !== false
                    ? fopen($realPath, 'rb')
                    : false;

                if ($stream === false) {
                    $validator->errors()->add('transcript', 'The transcript must be a valid PDF file.');
                } else {
                    $signature = fread($stream, 5);
                    fclose($stream);

                    if ($signature !== '%PDF-') {
                        $validator->errors()->add('transcript', 'The transcript contents must be a valid PDF file.');
                    }
                }
            }

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
