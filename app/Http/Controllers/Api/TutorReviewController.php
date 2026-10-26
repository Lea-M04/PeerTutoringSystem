<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class TutorReviewController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Review::class);

        $profile = $request->user()->tutorProfile()
            ->withAvg('reviews', 'rating')
            ->withCount('reviews')
            ->firstOrFail();
        $reviews = $profile->reviews()
            ->with(['booking.student:id,first_name,last_name'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return ReviewResource::collection($reviews)->additional([
            'meta' => [
                'average_rating' => $profile->reviews_avg_rating === null ? null : round((float) $profile->reviews_avg_rating, 2),
                'review_count' => (int) $profile->reviews_count,
            ],
        ]);
    }
}
