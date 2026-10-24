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
}
