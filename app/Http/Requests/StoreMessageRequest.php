<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use App\Models\Conversation;

class StoreMessageRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $conversation = $this->route('conversation');

        return $conversation instanceof Conversation
            && ($this->user()?->can('sendMessage', $conversation) ?? false);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_message_id' => ['required', 'uuid'],
            'body' => ['nullable', 'string', 'max:5000'],
            'attachment' => ['sometimes', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120', 'dimensions:max_width=6000,max_height=6000'],
            'sender_id' => ['prohibited'],
            'read_at' => ['prohibited'],
            'conversation_id' => ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $validator->errors()->hasAny(['body', 'attachment'])
                && trim((string) $this->input('body', '')) === ''
                && ! $this->hasFile('attachment')) {
                $validator->errors()->add('body', 'Add a message or choose an image.');
            }
        });
    }
}
