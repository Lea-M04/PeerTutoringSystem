<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class BookingManagementController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAdminAny', Booking::class);

        $filters = $request->validate([
            'status' => ['sometimes', 'nullable', 'in:pending,accepted,rejected,cancelled,completed'],
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $bookings = Booking::query()
            ->with(['student:id,name,first_name,last_name', 'tutorProfile.user:id,name,first_name,last_name', 'subject', 'review'])
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when(trim($filters['search'] ?? '') !== '', function (Builder $query) use ($filters): void {
                $term = '%'.mb_strtolower(trim($filters['search'])).'%';
                $query->where(fn (Builder $matches) => $matches
                    ->whereHas('student', fn (Builder $student) => $student->whereRaw('LOWER(name) LIKE ?', [$term]))
                    ->orWhereHas('tutorProfile.user', fn (Builder $tutor) => $tutor->whereRaw('LOWER(name) LIKE ?', [$term]))
                    ->orWhereHas('subject', fn (Builder $subject) => $subject->whereRaw('LOWER(name) LIKE ?', [$term])));
            })
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->get();

        return BookingResource::collection($bookings);
    }

    public function show(Booking $booking): BookingResource
    {
        Gate::authorize('viewAdmin', $booking);

        return BookingResource::make($booking->load([
            'student:id,name,first_name,last_name',
            'tutorProfile.user:id,name,first_name,last_name',
            'subject',
            'review',
        ]));
    }
}
