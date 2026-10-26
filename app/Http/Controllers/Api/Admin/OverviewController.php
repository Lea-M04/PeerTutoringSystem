<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class OverviewController extends Controller
{
    public function __invoke(): JsonResponse
    {
        Gate::authorize('viewAdminOverview', User::class);

        $bookingCounts = Booking::query()
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return response()->json([
            'data' => [
                'users' => [
                    'total' => User::query()->count(),
                    'active' => User::query()->where('is_active', true)->count(),
                ],
                'pending_tutor_applications' => TutorApplication::query()->where('status', TutorApplication::PENDING)->count(),
                'active_subjects' => Subject::query()->where('is_active', true)->count(),
                'bookings' => collect([
                    Booking::PENDING,
                    Booking::ACCEPTED,
                    Booking::REJECTED,
                    Booking::CANCELLED,
                    Booking::COMPLETED,
                ])->mapWithKeys(fn (string $status): array => [$status => (int) ($bookingCounts[$status] ?? 0)]),
                'tutors' => User::query()
                    ->where('is_active', true)
                    ->whereHas('roles', fn ($query) => $query->where('name', Role::TUTOR))
                    ->whereHas('tutorApplications', fn ($query) => $query->where('status', TutorApplication::APPROVED))
                    ->count(),
            ],
        ]);
    }
}
