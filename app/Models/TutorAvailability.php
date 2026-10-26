<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['starts_at', 'ends_at'])]
class TutorAvailability extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
        ];
    }

    public function tutorProfile(): BelongsTo
    {
        return $this->belongsTo(TutorProfile::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'tutor_availability_id');
    }

    public function hasReservingBookings(): bool
    {
        return $this->bookings()->whereIn('status', Booking::RESERVING_STATUSES)->exists();
    }
}
