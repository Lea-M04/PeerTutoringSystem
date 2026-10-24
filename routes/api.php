<?php

use App\Http\Controllers\Api\Admin\SubjectManagementController;
use App\Http\Controllers\Api\Admin\TutorApplicationReviewController;
use App\Http\Controllers\Api\AuthenticatedUserController;
use App\Http\Controllers\Api\TutorApplicationController;
use App\Http\Controllers\Api\TutorDirectoryController;
use App\Http\Controllers\Api\TutorProfileController;
use App\Http\Controllers\Api\TutorSubjectController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\TutorProfile;
use App\Models\TutorSubject;
use Illuminate\Support\Facades\Route;

Route::post('/password/forgot', [PasswordResetController::class, 'requestLink'])
    ->middleware('throttle:password-reset')
    ->name('api.password.forgot');
Route::post('/password/reset', [PasswordResetController::class, 'reset'])
    ->middleware('throttle:6,1')
    ->name('api.password.reset');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/user', AuthenticatedUserController::class)->name('api.user');
    Route::patch('/user', [AuthenticatedUserController::class, 'update'])->name('api.user.update');
    Route::get('/tutor-profile', [TutorProfileController::class, 'show'])
        ->can('manageOwn', TutorProfile::class)
        ->name('api.tutor-profile.show');
    Route::patch('/tutor-profile', [TutorProfileController::class, 'update'])
        ->can('manageOwn', TutorProfile::class)
        ->name('api.tutor-profile.update');
    Route::get('/subjects', [TutorApplicationController::class, 'subjects'])->name('api.subjects.index');
    Route::get('/tutors', [TutorDirectoryController::class, 'index'])->name('api.tutors.index');
    Route::get('/tutors/{tutorProfile}', [TutorDirectoryController::class, 'show'])->whereNumber('tutorProfile')->name('api.tutors.show');
    Route::get('/tutor-profile/offerings', [TutorSubjectController::class, 'index'])
        ->can('viewAny', TutorSubject::class)
        ->name('api.tutor-offerings.index');
    Route::post('/tutor-profile/offerings', [TutorSubjectController::class, 'store'])->name('api.tutor-offerings.store');
    Route::patch('/tutor-profile/offerings/{tutorSubject}', [TutorSubjectController::class, 'update'])
        ->can('update', 'tutorSubject')
        ->name('api.tutor-offerings.update');
    Route::delete('/tutor-profile/offerings/{tutorSubject}', [TutorSubjectController::class, 'destroy'])
        ->can('delete', 'tutorSubject')
        ->name('api.tutor-offerings.destroy');

    Route::get('/tutor-applications', [TutorApplicationController::class, 'index'])
        ->name('api.tutor-applications.index');
    Route::post('/tutor-applications', [TutorApplicationController::class, 'store'])
        ->name('api.tutor-applications.store');

    Route::prefix('admin')->name('api.admin.')->group(function (): void {
        Route::get('/subjects', [SubjectManagementController::class, 'index'])
            ->can('viewAny', Subject::class)
            ->name('subjects.index');
        Route::post('/subjects', [SubjectManagementController::class, 'store'])
            ->can('create', Subject::class)
            ->name('subjects.store');
        Route::patch('/subjects/{subject}', [SubjectManagementController::class, 'update'])
            ->can('update', 'subject')
            ->name('subjects.update');
        Route::patch('/subjects/{subject}/status', [SubjectManagementController::class, 'updateStatus'])
            ->can('update', 'subject')
            ->name('subjects.status');

        Route::get('/tutor-applications', [TutorApplicationReviewController::class, 'index'])
            ->can('viewAny', TutorApplication::class)
            ->name('tutor-applications.index');
        Route::get('/tutor-applications/{tutorApplication}/transcript', [TutorApplicationReviewController::class, 'downloadTranscript'])
            ->name('tutor-applications.transcript');
        Route::post('/tutor-applications/{tutorApplication}/approve', [TutorApplicationReviewController::class, 'approve'])
            ->can('review', 'tutorApplication')
            ->name('tutor-applications.approve');
        Route::post('/tutor-applications/{tutorApplication}/reject', [TutorApplicationReviewController::class, 'reject'])
            ->can('review', 'tutorApplication')
            ->name('tutor-applications.reject');
    });
});
