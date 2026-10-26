<?php

namespace App\Models;

use Database\Factories\InAppNotificationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'event_key', 'type', 'title', 'message', 'booking_id', 'tutor_application_id', 'read_at'])]
class InAppNotification extends Model
{
    /** @use HasFactory<InAppNotificationFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'read_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function tutorApplication(): BelongsTo
    {
        return $this->belongsTo(TutorApplication::class);
    }
}
