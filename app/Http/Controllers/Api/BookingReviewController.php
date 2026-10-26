<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingReviewRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Review;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class BookingReviewController extends Controller
{
    public function store(StoreBookingReviewRequest $request, Booking $booking): JsonResponse
    {
        Gate::authorize('create', [Review::class, $booking]);

        try {
            $reviewedBooking = DB::transaction(function () use ($request, $booking): Booking {
                $lockedBooking = Booking::query()->whereKey($booking->getKey())->lockForUpdate()->firstOrFail();

                if ($lockedBooking->status !== Booking::COMPLETED) {
                    abort(422, 'Only completed bookings can be reviewed.');
                }

                if ($lockedBooking->review()->exists()) {
                    abort(409, 'This booking already has a review.');
                }

                $lockedBooking->review()->create($request->validated());

                return $lockedBooking->refresh()->load([
                    'student:id,name,first_name,last_name',
                    'tutorProfile.user:id,name,first_name,last_name',
                    'subject',
                    'review',
                ]);
            });
        } catch (QueryException $exception) {
            if (Review::query()->where('booking_id', $booking->getKey())->exists()) {
                abort(409, 'This booking already has a review.');
            }

            throw $exception;
        }

        return BookingResource::make($reviewedBooking)->response()->setStatusCode(201);
    }
}
