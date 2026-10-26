<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTutorAvailabilityRequest;
use App\Http\Requests\UpdateTutorAvailabilityRequest;
use App\Http\Resources\TutorAvailabilityResource;
use App\Models\Booking;
use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\TutorAvailability;
use App\Models\TutorProfile;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TutorAvailabilityController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return TutorAvailabilityResource::collection(
            $request->user()->tutorProfile->availabilities()->orderBy('starts_at')->get(),
        );
    }

    public function store(StoreTutorAvailabilityRequest $request): JsonResponse
    {
        $values = $request->validated();
        $availability = DB::transaction(function () use ($request, $values): TutorAvailability {
            $profile = TutorProfile::query()
                ->where('user_id', $request->user()->getKey())
                ->lockForUpdate()
                ->firstOrFail();
            $startsAt = Carbon::parse($values['starts_at'])->utc();
            $endsAt = Carbon::parse($values['ends_at'])->utc();

            $this->ensureNoOverlap($profile, $startsAt, $endsAt);

            return $profile->availabilities()->create([
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
            ]);
        });

        return TutorAvailabilityResource::make($availability)->response()->setStatusCode(201);
    }

    public function update(UpdateTutorAvailabilityRequest $request, TutorAvailability $tutorAvailability): JsonResponse
    {
        $values = $request->validated();
        $availability = DB::transaction(function () use ($request, $tutorAvailability, $values): TutorAvailability {
            $profile = TutorProfile::query()
                ->where('user_id', $request->user()->getKey())
                ->lockForUpdate()
                ->firstOrFail();
            $availability = $profile->availabilities()
                ->whereKey($tutorAvailability->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($availability->hasReservingBookings()) {
                abort(409, 'This availability cannot be edited while it has a pending or accepted booking.');
            }

            $startsAt = Carbon::parse($values['starts_at'])->utc();
            $endsAt = Carbon::parse($values['ends_at'])->utc();

            $this->ensureNoOverlap($profile, $startsAt, $endsAt, $availability->getKey());
            $availability->update(['starts_at' => $startsAt, 'ends_at' => $endsAt]);

            return $availability->refresh();
        });

        return TutorAvailabilityResource::make($availability)->response();
    }

    public function destroy(Request $request, TutorAvailability $tutorAvailability): Response|JsonResponse
    {
        try {
            DB::transaction(function () use ($request, $tutorAvailability): void {
                $profile = TutorProfile::query()
                    ->where('user_id', $request->user()->getKey())
                    ->lockForUpdate()
                    ->firstOrFail();
                $availability = $profile->availabilities()
                    ->whereKey($tutorAvailability->getKey())
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($availability->hasReservingBookings()) {
                    abort(409, 'This availability cannot be deleted while it has a pending or accepted booking.');
                }

                $availability->delete();
            });
        } catch (QueryException $exception) {
            if (TutorAvailability::query()->whereKey($tutorAvailability->getKey())->whereHas('bookings')->exists()) {
                return response()->json([
                    'message' => 'This availability is part of booking history and cannot be deleted.',
                ], 409);
            }

            throw $exception;
        }

        return response()->noContent();
    }

    public function forTutor(Request $request, TutorProfile $tutorProfile): AnonymousResourceCollection
    {
        abort_unless($request->user()->hasRole(Role::STUDENT), 403);

        $eligibleProfile = $this->discoverableTutors($request)
            ->whereKey($tutorProfile->getKey())
            ->firstOrFail();

        return TutorAvailabilityResource::collection(
            $eligibleProfile->availabilities()
                ->where('starts_at', '>', now())
                ->where('ends_at', '>', now())
                ->whereDoesntHave('bookings', fn (Builder $query) => $query->whereIn('status', Booking::RESERVING_STATUSES))
                ->orderBy('starts_at')
                ->get(),
        );
    }

    private function ensureNoOverlap(TutorProfile $profile, Carbon $startsAt, Carbon $endsAt, ?int $exceptId = null): void
    {
        $overlaps = $profile->availabilities()
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt);

        if ($exceptId !== null) {
            $overlaps->where('id', '<>', $exceptId);
        }

        if ($overlaps->exists()) {
            throw ValidationException::withMessages([
                'starts_at' => 'This time interval overlaps another availability interval.',
            ]);
        }
    }

    /** @return Builder<TutorProfile> */
    private function discoverableTutors(Request $request): Builder
    {
        return TutorProfile::query()
            ->where('user_id', '<>', $request->user()->getKey())
            ->whereHas('user', fn ($query) => $query->where('is_active', true))
            ->whereHas('user.roles', fn ($query) => $query->where('name', Role::TUTOR))
            ->whereHas('user.tutorApplications', fn ($query) => $query->where('status', TutorApplication::APPROVED))
            ->whereHas('offerings', fn ($query) => $query->whereHas('subject', fn ($subject) => $subject->where('is_active', true)));
    }
}
