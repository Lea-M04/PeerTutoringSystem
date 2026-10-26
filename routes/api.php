<?php

use App\Http\Controllers\Api\Admin\BookingManagementController;
use App\Http\Controllers\Api\Admin\OverviewController;
use App\Http\Controllers\Api\Admin\SubjectManagementController;
use App\Http\Controllers\Api\Admin\TutorApplicationReviewController;
use App\Http\Controllers\Api\Admin\TutorOfferingManagementController;
use App\Http\Controllers\Api\Admin\UserManagementController;
use App\Http\Controllers\Api\AuthenticatedUserController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\BookingReviewController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\TutorApplicationController;
use App\Http\Controllers\Api\TutorAvailabilityController;
use App\Http\Controllers\Api\TutorDirectoryController;
use App\Http\Controllers\Api\TutorProfileController;
use App\Http\Controllers\Api\TutorReviewController;
use App\Http\Controllers\Api\TutorSubjectController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Models\Booking;
use App\Models\Review;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\TutorAvailability;
use App\Models\TutorProfile;
use App\Models\TutorSubject;
use App\Models\User;
use Illuminate\Support\Facades\Route;

Route::post('/password/forgot', [PasswordResetController::class, 'requestLink'])
    ->middleware('throttle:password-reset')
    ->name('api.password.forgot');
Route::post('/password/reset', [PasswordResetController::class, 'reset'])
    ->middleware('throttle:6,1')
    ->name('api.password.reset');

Route::middleware(['auth:sanctum', 'active.account'])->group(function (): void {
    Route::get('/notifications', [NotificationController::class, 'index'])->name('api.notifications.index');
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount'])->name('api.notifications.unread-count');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('api.notifications.read-all');
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])
        ->whereNumber('notification')
        ->name('api.notifications.read');

    Route::get('/bookings', [BookingController::class, 'studentIndex'])
        ->can('viewStudentBookings', Booking::class)
        ->name('api.bookings.student.index');
    Route::post('/bookings', [BookingController::class, 'store'])
        ->name('api.bookings.store');
    Route::post('/bookings/{booking}/review', [BookingReviewController::class, 'store'])
        ->whereNumber('booking')
        ->name('api.bookings.review.store');
    Route::get('/bookings/{booking}', [BookingController::class, 'studentShow'])
        ->can('viewAsStudent', 'booking')
        ->whereNumber('booking')
        ->name('api.bookings.student.show');
    Route::post('/bookings/{booking}/cancel', [BookingController::class, 'cancel'])
        ->can('cancelAsStudent', 'booking')
        ->whereNumber('booking')
        ->name('api.bookings.cancel');
    Route::get('/tutor-profile/bookings', [BookingController::class, 'tutorIndex'])
        ->can('viewTutorBookings', Booking::class)
        ->name('api.bookings.tutor.index');
    Route::get('/tutor-profile/reviews', [TutorReviewController::class, 'index'])
        ->can('viewAny', Review::class)
        ->name('api.tutor-reviews.index');
    Route::get('/tutor-profile/bookings/{booking}', [BookingController::class, 'tutorShow'])
        ->can('viewAsTutor', 'booking')
        ->whereNumber('booking')
        ->name('api.bookings.tutor.show');
    Route::post('/tutor-profile/bookings/{booking}/accept', [BookingController::class, 'accept'])
        ->can('accept', 'booking')
        ->whereNumber('booking')
        ->name('api.bookings.accept');
    Route::post('/tutor-profile/bookings/{booking}/reject', [BookingController::class, 'reject'])
        ->can('reject', 'booking')
        ->whereNumber('booking')
        ->name('api.bookings.reject');
    Route::post('/tutor-profile/bookings/{booking}/complete', [BookingController::class, 'complete'])
        ->can('complete', 'booking')
        ->whereNumber('booking')
        ->name('api.bookings.complete');

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
    Route::get('/tutors/{tutorProfile}/availability', [TutorAvailabilityController::class, 'forTutor'])
        ->whereNumber('tutorProfile')
        ->name('api.tutors.availability');
    Route::get('/tutor-profile/availability', [TutorAvailabilityController::class, 'index'])
        ->can('viewAny', TutorAvailability::class)
        ->name('api.tutor-availability.index');
    Route::post('/tutor-profile/availability', [TutorAvailabilityController::class, 'store'])
        ->can('create', TutorAvailability::class)
        ->name('api.tutor-availability.store');
    Route::put('/tutor-profile/availability/{tutorAvailability}', [TutorAvailabilityController::class, 'update'])
        ->can('update', 'tutorAvailability')
        ->name('api.tutor-availability.update');
    Route::delete('/tutor-profile/availability/{tutorAvailability}', [TutorAvailabilityController::class, 'destroy'])
        ->can('delete', 'tutorAvailability')
        ->name('api.tutor-availability.destroy');
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
        Route::get('/overview', OverviewController::class)
            ->can('viewAdminOverview', User::class)
            ->name('overview');
        Route::get('/bookings', [BookingManagementController::class, 'index'])
            ->can('viewAdminAny', Booking::class)
            ->name('bookings.index');
        Route::get('/bookings/{booking}', [BookingManagementController::class, 'show'])
            ->can('viewAdmin', 'booking')
            ->whereNumber('booking')
            ->name('bookings.show');
        Route::get('/tutors', [TutorOfferingManagementController::class, 'tutors'])
            ->can('adminViewAny', TutorSubject::class)
            ->name('tutors.index');
        Route::get('/tutor-offerings', [TutorOfferingManagementController::class, 'index'])
            ->can('adminViewAny', TutorSubject::class)
            ->name('tutor-offerings.index');
        Route::post('/tutor-offerings', [TutorOfferingManagementController::class, 'store'])
            ->can('adminCreate', TutorSubject::class)
            ->name('tutor-offerings.store');
        Route::patch('/tutor-offerings/{tutorSubject}', [TutorOfferingManagementController::class, 'update'])
            ->can('adminUpdate', 'tutorSubject')
            ->name('tutor-offerings.update');
        Route::delete('/tutor-offerings/{tutorSubject}', [TutorOfferingManagementController::class, 'destroy'])
            ->can('adminDelete', 'tutorSubject')
            ->name('tutor-offerings.destroy');
        Route::get('/users', [UserManagementController::class, 'index'])
            ->can('viewAny', User::class)
            ->name('users.index');
        Route::get('/users/{user}', [UserManagementController::class, 'show'])
            ->can('view', 'user')
            ->whereNumber('user')
            ->name('users.show');
        Route::patch('/users/{user}', [UserManagementController::class, 'update'])
            ->can('update', 'user')
            ->whereNumber('user')
            ->name('users.update');
        Route::patch('/users/{user}/status', [UserManagementController::class, 'updateStatus'])
            ->can('updateStatus', 'user')
            ->whereNumber('user')
            ->name('users.status');
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
        Route::delete('/subjects/{subject}', [SubjectManagementController::class, 'destroy'])
            ->can('delete', 'subject')
            ->name('subjects.destroy');

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
