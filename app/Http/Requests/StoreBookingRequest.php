<?php

namespace App\Http\Requests;

use App\Models\Booking;
use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', Booking::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'availability_id' => ['required', 'integer', 'exists:tutor_availabilities,id'],
            'tutor_subject_id' => ['required', 'integer', 'exists:tutor_subjects,id'],
            'student_id' => ['prohibited'],
            'tutor_profile_id' => ['prohibited'],
            'tutor_availability_id' => ['prohibited'],
            'subject_id' => ['prohibited'],
            'status' => ['prohibited'],
            'starts_at' => ['prohibited'],
            'ends_at' => ['prohibited'],
        ];
    }
}
