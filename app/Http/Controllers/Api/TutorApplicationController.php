<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTutorApplicationRequest;
use App\Http\Resources\SubjectResource;
use App\Http\Resources\TutorApplicationResource;
use App\Models\Subject;
use App\Models\TutorApplication;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class TutorApplicationController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAnyOwn', TutorApplication::class);

        return TutorApplicationResource::collection($request->user()->tutorApplications()->with('subjects')->latest()->get());
    }

    public function subjects()
    {
        return SubjectResource::collection(Subject::query()->where('is_active', true)->orderBy('name')->get());
    }

    public function store(StoreTutorApplicationRequest $request): JsonResponse
    {
        if ($request->user()->tutorApplications()->where('status', TutorApplication::PENDING)->exists()) {
            throw ValidationException::withMessages(['application' => 'You already have a pending tutor application.']);
        }

        try {
            $application = DB::transaction(function () use ($request): TutorApplication {
                $application = $request->user()->tutorApplications()->create([
                    'motivation' => $request->validated('motivation'),
                ]);
                $application->subjects()->sync($request->validated('subject_ids'));

                return $application->refresh()->load('subjects');
            });
        } catch (QueryException $exception) {
            if ($request->user()->tutorApplications()->where('status', TutorApplication::PENDING)->exists()) {
                throw ValidationException::withMessages(['application' => 'You already have a pending tutor application.']);
            }
            throw $exception;
        }

        return TutorApplicationResource::make($application)->response()->setStatusCode(201);
    }
}
