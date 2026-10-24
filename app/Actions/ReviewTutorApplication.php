<?php

namespace App\Actions;

use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReviewTutorApplication
{
    public function execute(TutorApplication $tutorApplication, User $reviewer, string $status, ?string $reason = null): TutorApplication
    {
        return DB::transaction(function () use ($tutorApplication, $reviewer, $status, $reason): TutorApplication {
            $application = TutorApplication::query()->whereKey($tutorApplication->getKey())->lockForUpdate()->firstOrFail();
            if ($application->status !== TutorApplication::PENDING) {
                throw ValidationException::withMessages(['application' => 'This application has already been reviewed.']);
            }

            $application->forceFill([
                'status' => $status,
                'reviewer_id' => $reviewer->id,
                'reviewed_at' => now(),
                'rejection_reason' => $reason,
            ])->save();

            if ($status === TutorApplication::APPROVED) {
                $tutorRole = Role::query()->where('name', Role::TUTOR)->firstOrFail();
                $tutor = $application->applicant;
                $tutor->roles()->syncWithoutDetaching([$tutorRole->id]);
                $tutor->tutorProfile()->firstOrCreate([]);
            }

            return $application->load(['applicant', 'subjects']);
        });
    }
}
