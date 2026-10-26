<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\TutorSubjectResource;
use App\Models\Booking;
use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\TutorProfile;
use App\Models\TutorSubject;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class TutorOfferingManagementController extends Controller
{
    public function tutors(): JsonResponse
    {
        Gate::authorize('adminViewAny', TutorSubject::class);

        $tutors = TutorProfile::query()
            ->with('user:id,name,is_active')
            ->whereHas('user', fn (Builder $query) => $query
                ->where('is_active', true)
                ->whereHas('roles', fn (Builder $roles) => $roles->where('name', Role::TUTOR))
                ->whereHas('tutorApplications', fn (Builder $applications) => $applications->where('status', TutorApplication::APPROVED)))
            ->orderBy('id')
            ->get()
            ->map(fn (TutorProfile $profile): array => [
                'id' => $profile->getKey(),
                'name' => $profile->user->name,
            ]);

        return response()->json(['data' => $tutors]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('adminViewAny', TutorSubject::class);

        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'subject_id' => ['sometimes', 'nullable', 'integer', 'exists:subjects,id'],
            'tutor_profile_id' => ['sometimes', 'nullable', 'integer', 'exists:tutor_profiles,id'],
            'status' => ['sometimes', 'nullable', 'in:active,inactive'],
        ]);

        $offerings = TutorSubject::query()
            ->with(['subject', 'tutorProfile.user:id,name,is_active'])
            ->whereHas('tutorProfile.user.roles', fn (Builder $query) => $query->where('name', Role::TUTOR))
            ->when($filters['subject_id'] ?? null, fn (Builder $query, int $subjectId) => $query->where('subject_id', $subjectId))
            ->when($filters['tutor_profile_id'] ?? null, fn (Builder $query, int $profileId) => $query->where('tutor_profile_id', $profileId))
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->whereHas('subject', fn (Builder $subject) => $subject->where('is_active', $status === 'active')))
            ->when(trim($filters['search'] ?? '') !== '', function (Builder $query) use ($filters): void {
                $term = '%'.mb_strtolower(trim($filters['search'])).'%';
                $query->where(fn (Builder $matches) => $matches
                    ->whereHas('subject', fn (Builder $subject) => $subject->whereRaw('LOWER(name) LIKE ?', [$term]))
                    ->orWhereHas('tutorProfile.user', fn (Builder $user) => $user->whereRaw('LOWER(name) LIKE ?', [$term])));
            })
            ->orderBy('tutor_profile_id')
            ->orderBy('subject_id')
            ->get();

        return TutorSubjectResource::collection($offerings);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('adminCreate', TutorSubject::class);

        $values = $request->validate([
            'tutor_profile_id' => ['required', 'integer', 'exists:tutor_profiles,id'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'description' => ['nullable', 'string', 'max:1200'],
        ]);

        $this->ensureEligibleTutor((int) $values['tutor_profile_id']);
        $this->ensureActiveSubject((int) $values['subject_id']);

        try {
            $offering = DB::transaction(function () use ($values): TutorSubject {
                $tutorProfile = TutorProfile::query()->findOrFail($values['tutor_profile_id']);

                return $tutorProfile->offerings()->create([
                    'subject_id' => $values['subject_id'],
                    'description' => $values['description'] ?? null,
                ]);
            });
        } catch (QueryException $exception) {
            if (in_array((string) $exception->getCode(), ['23000', '23505'], true)
                && TutorSubject::query()->where('tutor_profile_id', $values['tutor_profile_id'])->where('subject_id', $values['subject_id'])->exists()) {
                throw ValidationException::withMessages(['subject_id' => 'This tutor already offers the selected subject.']);
            }

            throw $exception;
        }

        return TutorSubjectResource::make($offering->load(['subject', 'tutorProfile.user:id,name,is_active']))
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, TutorSubject $tutorSubject): JsonResponse
    {
        Gate::authorize('adminUpdate', $tutorSubject);

        $values = $request->validate([
            'subject_id' => ['sometimes', 'required', 'integer', 'exists:subjects,id'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1200'],
        ]);

        $subjectId = (int) ($values['subject_id'] ?? $tutorSubject->subject_id);
        if (isset($values['subject_id']) && $subjectId !== $tutorSubject->subject_id) {
            $this->ensureActiveSubject($subjectId);
        }

        if ($tutorSubject->tutorProfile->offerings()
            ->where('subject_id', $subjectId)
            ->where('id', '<>', $tutorSubject->getKey())
            ->exists()) {
            throw ValidationException::withMessages(['subject_id' => 'This tutor already offers the selected subject.']);
        }

        $tutorSubject->fill($values)->save();

        return TutorSubjectResource::make($tutorSubject->refresh()->load(['subject', 'tutorProfile.user:id,name,is_active']))->response();
    }

    public function destroy(TutorSubject $tutorSubject): Response|JsonResponse
    {
        Gate::authorize('adminDelete', $tutorSubject);

        if (Booking::query()
            ->where('tutor_profile_id', $tutorSubject->tutor_profile_id)
            ->where('subject_id', $tutorSubject->subject_id)
            ->exists()) {
            return response()->json([
                'message' => 'This offering is linked to booking history and cannot be removed.',
            ], 409);
        }

        $tutorSubject->delete();

        return response()->noContent();
    }

    private function ensureEligibleTutor(int $profileId): void
    {
        $isEligible = TutorProfile::query()
            ->whereKey($profileId)
            ->whereHas('user', fn (Builder $query) => $query
                ->where('is_active', true)
                ->whereHas('roles', fn (Builder $roles) => $roles->where('name', Role::TUTOR))
                ->whereHas('tutorApplications', fn (Builder $applications) => $applications->where('status', TutorApplication::APPROVED)))
            ->exists();

        if (! $isEligible) {
            throw ValidationException::withMessages(['tutor_profile_id' => 'Choose an active, approved tutor.']);
        }
    }

    private function ensureActiveSubject(int $subjectId): void
    {
        if (! Subject::query()->whereKey($subjectId)->where('is_active', true)->exists()) {
            throw ValidationException::withMessages(['subject_id' => 'Choose an active catalogue subject.']);
        }
    }
}
