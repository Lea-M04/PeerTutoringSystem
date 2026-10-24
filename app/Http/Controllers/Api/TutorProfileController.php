<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateTutorProfileRequest;
use App\Http\Resources\TutorProfileResource;
use App\Models\TutorProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TutorProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        Gate::authorize('manageOwn', TutorProfile::class);

        $profile = $request->user()->tutorProfile ?? new TutorProfile(['biography' => null]);

        return TutorProfileResource::make($profile)->response();
    }

    public function update(UpdateTutorProfileRequest $request): JsonResponse
    {
        Gate::authorize('manageOwn', TutorProfile::class);

        $profile = $request->user()->tutorProfile()->firstOrCreate([]);
        $profile->fill($request->validated());
        $profile->save();

        return TutorProfileResource::make($profile->refresh())->response();
    }
}
