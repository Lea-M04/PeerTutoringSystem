<?php

namespace App\Http\Controllers\Api\Admin;

use App\Actions\ReviewTutorApplication;
use App\Http\Controllers\Controller;
use App\Http\Requests\RejectTutorApplicationRequest;
use App\Http\Resources\TutorApplicationResource;
use App\Models\TutorApplication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TutorApplicationReviewController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', TutorApplication::class);

        return TutorApplicationResource::collection(TutorApplication::query()->where('status', TutorApplication::PENDING)->with(['applicant', 'subjects'])->oldest()->get());
    }

    public function approve(Request $request, TutorApplication $tutorApplication, ReviewTutorApplication $reviewAction): JsonResponse
    {
        Gate::authorize('review', $tutorApplication);
        $application = $reviewAction->execute($tutorApplication, $request->user(), TutorApplication::APPROVED);

        return TutorApplicationResource::make($application)->response();
    }

    public function reject(RejectTutorApplicationRequest $request, TutorApplication $tutorApplication, ReviewTutorApplication $reviewAction): JsonResponse
    {
        Gate::authorize('review', $tutorApplication);
        $application = $reviewAction->execute($tutorApplication, $request->user(), TutorApplication::REJECTED, $request->validated('reason'));

        return TutorApplicationResource::make($application)->response();
    }
}
