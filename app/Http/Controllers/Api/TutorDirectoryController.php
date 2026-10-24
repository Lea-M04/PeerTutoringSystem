<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TutorDirectoryResource;
use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\TutorProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TutorDirectoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorizeStudent($request);

        return TutorDirectoryResource::collection($this->approvedTutors($request->user())->orderBy('id')->get());
    }

    public function show(Request $request, int $tutorProfile): JsonResponse
    {
        $this->authorizeStudent($request);

        $profile = $this->approvedTutors($request->user())->whereKey($tutorProfile)->firstOrFail();

        return TutorDirectoryResource::make($profile)->response();
    }

    private function authorizeStudent(Request $request): void
    {
        abort_unless($request->user()->hasRole(Role::STUDENT), 403);
    }

    /** @return Builder<TutorProfile> */
    private function approvedTutors(User $viewer): Builder
    {
        return TutorProfile::query()
            ->where('user_id', '<>', $viewer->getKey())
            ->whereHas('user.roles', fn ($query) => $query->where('name', Role::TUTOR))
            ->whereHas('user.tutorApplications', fn ($query) => $query->where('status', TutorApplication::APPROVED))
            ->whereHas('offerings', fn ($query) => $query->whereHas('subject', fn ($subject) => $subject->where('is_active', true)))
            ->with([
                'user:id,name,first_name,last_name,faculty_or_university,study_program,year_of_study',
                'offerings' => fn ($query) => $query
                    ->whereHas('subject', fn ($subject) => $subject->where('is_active', true))
                    ->with('subject:id,name'),
            ]);
    }
}
