<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSubjectRequest;
use App\Http\Requests\UpdateSubjectRequest;
use App\Http\Requests\UpdateSubjectStatusRequest;
use App\Http\Resources\SubjectResource;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class SubjectManagementController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return SubjectResource::collection(Subject::query()->orderBy('name')->get());
    }

    public function store(StoreSubjectRequest $request): JsonResponse
    {
        $subject = Subject::query()->create($request->validated())->refresh();

        return SubjectResource::make($subject)->response()->setStatusCode(201);
    }

    public function update(UpdateSubjectRequest $request, Subject $subject): JsonResponse
    {
        $subject->fill($request->validated())->save();

        return SubjectResource::make($subject->refresh())->response();
    }

    public function updateStatus(UpdateSubjectStatusRequest $request, Subject $subject): JsonResponse
    {
        $subject->forceFill(['is_active' => $request->validated('is_active')])->save();

        return SubjectResource::make($subject->refresh())->response();
    }

    public function destroy(Subject $subject): Response|JsonResponse
    {
        $deleted = DB::transaction(function () use ($subject): bool {
            $lockedSubject = Subject::query()->whereKey($subject->getKey())->lockForUpdate()->firstOrFail();

            if ($lockedSubject->tutorProfiles()->exists()
                || $lockedSubject->tutorApplications()->exists()
                || $lockedSubject->bookings()->exists()) {
                return false;
            }

            $lockedSubject->delete();

            return true;
        });

        if (! $deleted) {
            return response()->json([
                'message' => 'This subject is linked to tutor applications, offerings, or booking history. Deactivate it instead to preserve those records.',
            ], 409);
        }

        return response()->noContent();
    }
}
