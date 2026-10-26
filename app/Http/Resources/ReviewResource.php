<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReviewResource extends JsonResource
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
            'rating' => $this->rating,
            'comment' => $this->comment,
            'created_at' => $this->created_at?->toISOString(),
            'reviewer' => $this->whenLoaded('booking', fn (): array => [
                'name' => $this->booking->student?->first_name
                    ? $this->booking->student->first_name.' '.mb_substr((string) $this->booking->student->last_name, 0, 1).'.'
                    : 'Student',
            ]),
        ];
    }
}
