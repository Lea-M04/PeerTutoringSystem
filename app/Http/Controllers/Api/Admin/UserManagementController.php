<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminUpdateUserRequest;
use App\Http\Requests\UpdateUserAccountStatusRequest;
use App\Http\Resources\AdminUserResource;
use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class UserManagementController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AdminUserResource::collection(
            $this->users()->with('roles')->orderBy('name')->get(),
        );
    }

    public function show(User $user): JsonResponse
    {
        $profile = $this->users()
            ->with([
                'roles',
                'tutorProfile.offerings' => fn ($query) => $query
                    ->whereHas('subject', fn ($subject) => $subject->where('is_active', true))
                    ->with('subject:id,name'),
                'tutorProfile.availabilities' => fn ($query) => $query->orderBy('starts_at'),
            ])
            ->whereKey($user->getKey())
            ->firstOrFail();

        return AdminUserResource::make($profile)->response();
    }

    public function update(AdminUpdateUserRequest $request, User $user): JsonResponse
    {
        $user->fill($request->validated());
        $user->name = trim($request->validated('first_name').' '.$request->validated('last_name'));
        $user->save();

        return AdminUserResource::make($user->fresh()->load('roles'))->response();
    }

    public function updateStatus(UpdateUserAccountStatusRequest $request, User $user): JsonResponse
    {
        $isActive = $request->boolean('is_active');
        $updated = DB::transaction(function () use ($user, $isActive): bool {
            if (! $isActive && $user->hasRole(Role::ADMIN)) {
                $activeAdministrators = User::query()
                    ->where('is_active', true)
                    ->whereHas('roles', fn ($query) => $query->where('name', Role::ADMIN))
                    ->lockForUpdate()
                    ->get()
                    ->count();

                if ($activeAdministrators <= 1) {
                    return false;
                }
            }

            $user->forceFill(['is_active' => $isActive])->save();

            return true;
        });

        if (! $updated) {
            return response()->json([
                'message' => 'The last active administrator cannot be deactivated.',
            ], 422);
        }

        return AdminUserResource::make($user->fresh()->load('roles'))->response();
    }

    /** @return Builder<User> */
    private function users(): Builder
    {
        return User::query()
            ->whereHas('roles', fn ($query) => $query->whereIn('name', [Role::STUDENT, Role::TUTOR]))
            ->withExists([
                'tutorApplications as has_approved_tutor_application' => fn ($query) => $query->where('status', TutorApplication::APPROVED),
            ]);
    }
}
