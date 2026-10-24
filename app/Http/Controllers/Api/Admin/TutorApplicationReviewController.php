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
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TutorApplicationReviewController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', TutorApplication::class);

        return TutorApplicationResource::collection(TutorApplication::query()->where('status', TutorApplication::PENDING)->with(['applicant', 'subjects'])->orderBy('created_at')->orderBy('id')->get());
    }

    public function downloadTranscript(TutorApplication $tutorApplication): StreamedResponse
    {
        Gate::authorize('viewTranscript', $tutorApplication);

        abort_if($tutorApplication->transcript_path === null, 404);

        $disk = Storage::disk('private');
        abort_unless($disk->exists($tutorApplication->transcript_path), 404);

        return $disk->download($tutorApplication->transcript_path, "application-{$tutorApplication->id}-transcript.pdf", [
            'Content-Type' => 'application/pdf',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
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
