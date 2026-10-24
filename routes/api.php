<?php

use App\Http\Controllers\Api\Admin\TutorApplicationReviewController;
use App\Http\Controllers\Api\AuthenticatedUserController;
use App\Http\Controllers\Api\TutorApplicationController;
use App\Http\Controllers\Api\TutorProfileController;
use App\Models\TutorApplication;
use App\Models\TutorProfile;
use Illuminate\Support\Facades\Route;

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

    Route::get('/tutor-applications', [TutorApplicationController::class, 'index'])
        ->name('api.tutor-applications.index');
    Route::post('/tutor-applications', [TutorApplicationController::class, 'store'])
        ->name('api.tutor-applications.store');

    Route::prefix('admin')->name('api.admin.')->group(function (): void {
        Route::get('/tutor-applications', [TutorApplicationReviewController::class, 'index'])
            ->can('viewAny', TutorApplication::class)
            ->name('tutor-applications.index');
        Route::post('/tutor-applications/{tutorApplication}/approve', [TutorApplicationReviewController::class, 'approve'])
            ->can('review', 'tutorApplication')
            ->name('tutor-applications.approve');
        Route::post('/tutor-applications/{tutorApplication}/reject', [TutorApplicationReviewController::class, 'reject'])
            ->can('review', 'tutorApplication')
            ->name('tutor-applications.reject');
    });
});
