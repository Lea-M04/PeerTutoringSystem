<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MessageAttachmentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'mime_type' => $this->mime_type,
            'size_bytes' => (int) $this->size_bytes,
            'width' => (int) $this->width,
            'height' => (int) $this->height,
            'url' => route('api.message-attachments.show', ['attachment' => $this->id], false),
        ];
    }
}
