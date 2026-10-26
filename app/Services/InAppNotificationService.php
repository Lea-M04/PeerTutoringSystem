<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\TutorApplication;
use Illuminate\Support\Facades\DB;

class InAppNotificationService
{
    public function bookingRequested(Booking $booking): void
    {
        $this->store((int) $booking->tutorProfile()->value('user_id'), "booking:{$booking->getKey()}:requested", 'booking_requested', 'New tutoring request', 'A student requested a tutoring session.', (int) $booking->getKey(), null);
    }

    public function bookingAccepted(Booking $booking): void
    {
        $this->store((int) $booking->student_id, "booking:{$booking->getKey()}:accepted", 'booking_accepted', 'Booking accepted', 'Your tutor accepted the tutoring session request.', (int) $booking->getKey(), null);
    }

    public function bookingRejected(Booking $booking): void
    {
        $this->store((int) $booking->student_id, "booking:{$booking->getKey()}:rejected", 'booking_rejected', 'Booking declined', 'Your tutor could not accept the tutoring session request.', (int) $booking->getKey(), null);
    }

    public function bookingCancelled(Booking $booking): void
    {
        $this->store((int) $booking->tutorProfile()->value('user_id'), "booking:{$booking->getKey()}:cancelled", 'booking_cancelled', 'Booking cancelled', 'A student cancelled the tutoring session request.', (int) $booking->getKey(), null);
    }

    public function bookingCompleted(Booking $booking): void
    {
        $this->store((int) $booking->student_id, "booking:{$booking->getKey()}:completed", 'booking_completed', 'Session completed', 'Your tutoring session is complete. If eligible, you can now leave a review.', (int) $booking->getKey(), null);
    }

    public function tutorApplicationApproved(TutorApplication $application): void
    {
        $this->store((int) $application->user_id, "tutor-application:{$application->getKey()}:approved", 'tutor_application_approved', 'Tutor application approved', 'Your tutor application has been approved. Tutor tools are now available.', null, (int) $application->getKey());
    }

    public function tutorApplicationRejected(TutorApplication $application): void
    {
        $this->store((int) $application->user_id, "tutor-application:{$application->getKey()}:rejected", 'tutor_application_rejected', 'Tutor application update', 'Your tutor application was not approved. Review the feedback in your application history.', null, (int) $application->getKey());
    }

    private function store(
        int $userId,
        string $eventKey,
        string $type,
        string $title,
        string $message,
        ?int $bookingId,
        ?int $tutorApplicationId,
    ): void {
        $timestamp = now();

        DB::table('in_app_notifications')->insertOrIgnore([
            'user_id' => $userId,
            'event_key' => $eventKey,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'booking_id' => $bookingId,
            'tutor_application_id' => $tutorApplicationId,
            'read_at' => null,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }
}
