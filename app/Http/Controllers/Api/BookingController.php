<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\TutorAvailability;
use App\Models\TutorProfile;
use App\Models\TutorSubject;
use App\Services\InAppNotificationService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    public function store(StoreBookingRequest $request, InAppNotificationService $notifications): JsonResponse
    {
        $availabilityId = $request->validated('availability_id');
        $tutorSubjectId = $request->validated('tutor_subject_id');

        try {
            $booking = DB::transaction(function () use ($request, $availabilityId, $tutorSubjectId, $notifications): Booking {
                $source = TutorAvailability::query()->find($availabilityId);

                if ($source === null) {
                    throw ValidationException::withMessages([
                        'availability_id' => 'This availability interval is no longer available.',
                    ]);
                }

                $profile = TutorProfile::query()
                    ->whereKey($source->tutor_profile_id)
                    ->lockForUpdate()
                    ->firstOrFail();
                $availability = $profile->availabilities()
                    ->whereKey($availabilityId)
                    ->lockForUpdate()
                    ->first();

                if ($availability === null) {
                    throw ValidationException::withMessages([
                        'availability_id' => 'This availability interval is no longer available.',
                    ]);
                }

                $offering = TutorSubject::query()
                    ->whereKey($tutorSubjectId)
                    ->where('tutor_profile_id', $profile->getKey())
                    ->lockForUpdate()
                    ->first();
                $subject = $offering === null
                    ? null
                    : Subject::query()->whereKey($offering->subject_id)->lockForUpdate()->first();

                if ($offering === null || $subject?->is_active !== true) {
                    throw ValidationException::withMessages([
                        'tutor_subject_id' => 'Choose an active subject offered by this tutor.',
                    ]);
                }

                if (! $this->isDiscoverableTutor($profile)) {
                    throw ValidationException::withMessages([
                        'availability_id' => 'This availability interval is no longer available.',
                    ]);
                }

                if ($profile->user_id === $request->user()->getKey()) {
                    throw ValidationException::withMessages([
                        'availability_id' => 'You cannot book your own availability.',
                    ]);
                }

                if ($availability->starts_at->lessThanOrEqualTo(now())) {
                    throw ValidationException::withMessages([
                        'availability_id' => 'Only future availability intervals can be booked.',
                    ]);
                }

                if ($availability->hasReservingBookings()) {
                    throw ValidationException::withMessages([
                        'availability_id' => 'This availability interval has already been requested.',
                    ]);
                }

                $booking = Booking::query()->create([
                    'student_id' => $request->user()->getKey(),
                    'tutor_profile_id' => $profile->getKey(),
                    'tutor_availability_id' => $availability->getKey(),
                    'subject_id' => $offering->subject_id,
                    'starts_at' => $availability->starts_at,
                    'ends_at' => $availability->ends_at,
                ]);

                $notifications->bookingRequested($booking);

                return $booking->refresh();
            });
        } catch (QueryException $exception) {
            if (Booking::query()
                ->where('tutor_availability_id', $availabilityId)
                ->whereIn('status', Booking::RESERVING_STATUSES)
                ->exists()) {
                return $this->conflict('This availability interval has already been requested.');
            }

            throw $exception;
        }

        return BookingResource::make($booking->load(['student:id,name,first_name,last_name', 'tutorProfile.user:id,name,first_name,last_name', 'subject']))
            ->response()
            ->setStatusCode(201);
    }

    public function studentIndex(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewStudentBookings', Booking::class);

        return BookingResource::collection(
            Booking::query()
                ->where('student_id', $request->user()->getKey())
                ->with(['student:id,name,first_name,last_name', 'tutorProfile.user:id,name,first_name,last_name', 'subject', 'review'])
                ->orderByDesc('starts_at')
                ->orderByDesc('id')
                ->get(),
        );
    }

    public function studentShow(Request $request, Booking $booking): BookingResource
    {
        Gate::authorize('viewAsStudent', $booking);

        return BookingResource::make($booking->load(['student:id,name,first_name,last_name', 'tutorProfile.user:id,name,first_name,last_name', 'subject', 'review']));
    }

    public function tutorIndex(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewTutorBookings', Booking::class);

        return BookingResource::collection(
            $request->user()->tutorProfile->bookings()
                ->with(['student:id,name,first_name,last_name', 'tutorProfile.user:id,name,first_name,last_name', 'subject'])
                ->orderByDesc('starts_at')
                ->orderByDesc('id')
                ->get(),
        );
    }

    public function tutorShow(Request $request, Booking $booking): BookingResource
    {
        Gate::authorize('viewAsTutor', $booking);

        return BookingResource::make($booking->load(['student:id,name,first_name,last_name', 'tutorProfile.user:id,name,first_name,last_name', 'subject', 'review']));
    }

    public function accept(Request $request, Booking $booking, InAppNotificationService $notifications): JsonResponse
    {
        return $this->review($request, $booking, Booking::ACCEPTED, 'accept', $notifications);
    }

    public function reject(Request $request, Booking $booking, InAppNotificationService $notifications): JsonResponse
    {
        return $this->review($request, $booking, Booking::REJECTED, 'reject', $notifications);
    }

    public function complete(Request $request, Booking $booking, InAppNotificationService $notifications): JsonResponse
    {
        Gate::authorize('complete', $booking);

        $completedBooking = DB::transaction(function () use ($request, $booking, $notifications): Booking {
            $profile = TutorProfile::query()
                ->where('user_id', $request->user()->getKey())
                ->lockForUpdate()
                ->firstOrFail();
            $ownedBooking = Booking::query()
                ->whereKey($booking->getKey())
                ->where('tutor_profile_id', $profile->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($ownedBooking->status !== Booking::ACCEPTED) {
                abort(409, 'Only accepted bookings can be marked as completed.');
            }

            if ($ownedBooking->ends_at->greaterThan(now())) {
                abort(409, 'A booking can only be completed after its session end time.');
            }

            $ownedBooking->forceFill(['status' => Booking::COMPLETED])->save();
            $notifications->bookingCompleted($ownedBooking);

            return $ownedBooking->refresh();
        });

        return BookingResource::make($completedBooking->load([
            'student:id,name,first_name,last_name',
            'tutorProfile.user:id,name,first_name,last_name',
            'subject',
        ]))->response();
    }

    public function cancel(Request $request, Booking $booking, InAppNotificationService $notifications): JsonResponse
    {
        Gate::authorize('cancelAsStudent', $booking);

        $cancelled = DB::transaction(function () use ($request, $booking, $notifications): Booking {
            TutorProfile::query()->whereKey($booking->tutor_profile_id)->lockForUpdate()->firstOrFail();
            $ownedBooking = Booking::query()
                ->whereKey($booking->getKey())
                ->where('student_id', $request->user()->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($ownedBooking->status, Booking::RESERVING_STATUSES, true)) {
                abort(409, 'Only pending or accepted bookings can be cancelled.');
            }

            if ($ownedBooking->starts_at->lessThan(now()->addHours(12))) {
                abort(409, 'Bookings can only be cancelled at least 12 hours before they start.');
            }

            $ownedBooking->forceFill(['status' => Booking::CANCELLED])->save();
            $notifications->bookingCancelled($ownedBooking);

            return $ownedBooking->refresh();
        });

        return BookingResource::make($cancelled->load(['student:id,name,first_name,last_name', 'tutorProfile.user:id,name,first_name,last_name', 'subject']))
            ->response();
    }

    private function review(Request $request, Booking $booking, string $status, string $ability, InAppNotificationService $notifications): JsonResponse
    {
        Gate::authorize($ability, $booking);

        $reviewedBooking = DB::transaction(function () use ($request, $booking, $status, $notifications): Booking {
            TutorProfile::query()
                ->where('user_id', $request->user()->getKey())
                ->lockForUpdate()
                ->firstOrFail();
            $ownedBooking = Booking::query()
                ->whereKey($booking->getKey())
                ->where('tutor_profile_id', $request->user()->tutorProfile->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($ownedBooking->status !== Booking::PENDING) {
                abort(409, 'Only pending bookings can be accepted or rejected.');
            }

            $ownedBooking->forceFill(['status' => $status])->save();

            if ($status === Booking::ACCEPTED) {
                $notifications->bookingAccepted($ownedBooking);
            } else {
                $notifications->bookingRejected($ownedBooking);
            }

            return $ownedBooking->refresh();
        });

        return BookingResource::make($reviewedBooking->load(['student:id,name,first_name,last_name', 'tutorProfile.user:id,name,first_name,last_name', 'subject']))
            ->response();
    }

    private function isDiscoverableTutor(TutorProfile $profile): bool
    {
        return $profile->user()->where('is_active', true)
            ->whereHas('roles', fn ($query) => $query->where('name', Role::TUTOR))
            ->whereHas('tutorApplications', fn ($query) => $query->where('status', TutorApplication::APPROVED))
            ->whereHas('tutorProfile.offerings', fn ($query) => $query->whereHas('subject', fn ($subject) => $subject->where('is_active', true)))
            ->exists();
    }

    private function conflict(string $message): JsonResponse
    {
        return response()->json(['message' => $message], 409);
    }
}
