<?php

namespace App\Models;

use Database\Factories\BookingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['student_id', 'tutor_profile_id', 'tutor_availability_id', 'subject_id', 'starts_at', 'ends_at'])]
class Booking extends Model
{
    /** @use HasFactory<BookingFactory> */
    use HasFactory;

    public const PENDING = 'pending';

    public const ACCEPTED = 'accepted';

    public const REJECTED = 'rejected';

    public const CANCELLED = 'cancelled';

    public const COMPLETED = 'completed';

    public const RESERVING_STATUSES = [self::PENDING, self::ACCEPTED];

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function tutorProfile(): BelongsTo
    {
        return $this->belongsTo(TutorProfile::class);
    }

    public function availability(): BelongsTo
    {
        return $this->belongsTo(TutorAvailability::class, 'tutor_availability_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function review(): HasOne
    {
        return $this->hasOne(Review::class);
    }

    public function reservesAvailability(): bool
    {
        return in_array($this->status, self::RESERVING_STATUSES, true);
    }
}
