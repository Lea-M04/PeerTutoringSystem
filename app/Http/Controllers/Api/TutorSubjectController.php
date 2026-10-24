<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTutorSubjectRequest;
use App\Http\Requests\UpdateTutorSubjectRequest;
use App\Http\Resources\TutorSubjectResource;
use App\Models\TutorSubject;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class TutorSubjectController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        return TutorSubjectResource::collection($user->tutorProfile->offerings()->with('subject')->orderBy('id')->get());
    }

    public function store(StoreTutorSubjectRequest $request): JsonResponse
    {
        $profile = $request->user()->tutorProfile;
        $subjectId = $request->validated('subject_id');

        if ($profile->offerings()->where('subject_id', $subjectId)->exists()) {
            throw ValidationException::withMessages(['subject_id' => 'You already offer this subject.']);
        }

        try {
            $offering = $profile->offerings()->create($request->safe()->only(['description']) + ['subject_id' => $subjectId]);
        } catch (QueryException $exception) {
            if (! in_array((string) $exception->getCode(), ['23000', '23505'], true)) {
                throw $exception;
            }

            throw ValidationException::withMessages(['subject_id' => 'You already offer this subject.']);
        }

        return TutorSubjectResource::make($offering->load('subject'))->response()->setStatusCode(201);
    }

    public function update(UpdateTutorSubjectRequest $request, TutorSubject $tutorSubject): JsonResponse
    {
        Gate::authorize('update', $tutorSubject);
        $validated = $request->safe()->only(['description', 'subject_id']);

        if (isset($validated['subject_id']) && $tutorSubject->tutorProfile->offerings()
            ->where('subject_id', $validated['subject_id'])
            ->where('id', '<>', $tutorSubject->getKey())
            ->exists()) {
            throw ValidationException::withMessages(['subject_id' => 'You already offer this subject.']);
        }

        try {
            $tutorSubject->fill($validated)->save();
        } catch (QueryException $exception) {
            if (isset($validated['subject_id']) && in_array((string) $exception->getCode(), ['23000', '23505'], true)) {
                throw ValidationException::withMessages(['subject_id' => 'You already offer this subject.']);
            }

            throw $exception;
        }

        return TutorSubjectResource::make($tutorSubject->refresh()->load('subject'))->response();
    }

    public function destroy(TutorSubject $tutorSubject): Response
    {
        Gate::authorize('delete', $tutorSubject);
        $tutorSubject->delete();

        return response()->noContent();
    }
}
