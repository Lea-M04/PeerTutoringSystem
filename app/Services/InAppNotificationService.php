<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\TutorApplication;
use Illuminate\Support\Facades\DB;

class InAppNotificationService
{
    public function __construct(private NotificationEmailService $emailNotifications) {}

    public function bookingRequested(Booking $booking): void
    {
        $booking->loadMissing(['student:id,name', 'subject:id,name', 'tutorProfile.user:id,name']);
        $this->store(
            (int) $booking->tutorProfile->user_id,
            "booking:{$booking->getKey()}:requested",
            'booking_requested',
            'New tutoring request',
            'A student requested a tutoring session.',
            (int) $booking->getKey(),
            null,
            ['Student' => $booking->student->name, ...$this->bookingDetails($booking)],
            $this->frontendUrl("/tutor-bookings/{$booking->getKey()}"),
            'View booking',
        );
    }

    public function bookingAccepted(Booking $booking): void
    {
        $booking->loadMissing(['subject:id,name', 'tutorProfile.user:id,name']);
        $this->store(
            (int) $booking->student_id,
            "booking:{$booking->getKey()}:accepted",
            'booking_accepted',
            'Booking accepted',
            'Your tutor accepted the tutoring session request.',
            (int) $booking->getKey(),
            null,
            ['Tutor' => $booking->tutorProfile->user->name, ...$this->bookingDetails($booking)],
            $this->frontendUrl("/bookings/{$booking->getKey()}"),
            'View booking',
        );
    }

    public function bookingRejected(Booking $booking): void
    {
        $booking->loadMissing(['subject:id,name', 'tutorProfile.user:id,name']);
        $this->store(
            (int) $booking->student_id,
            "booking:{$booking->getKey()}:rejected",
            'booking_rejected',
            'Booking declined',
            'Your tutor could not accept the tutoring session request.',
            (int) $booking->getKey(),
            null,
            ['Tutor' => $booking->tutorProfile->user->name, ...$this->bookingDetails($booking)],
            $this->frontendUrl("/bookings/{$booking->getKey()}"),
            'View booking',
        );
    }

    public function bookingCancelled(Booking $booking): void
    {
        $booking->loadMissing(['student:id,name', 'subject:id,name']);
        $this->store(
            (int) $booking->tutorProfile->user_id,
            "booking:{$booking->getKey()}:cancelled",
            'booking_cancelled',
            'Booking cancelled',
            'A student cancelled the tutoring session request.',
            (int) $booking->getKey(),
            null,
            ['Student' => $booking->student->name, ...$this->bookingDetails($booking)],
            $this->frontendUrl("/tutor-bookings/{$booking->getKey()}"),
            'View booking',
        );
    }

    public function bookingCompleted(Booking $booking): void
    {
        $booking->loadMissing(['subject:id,name', 'tutorProfile.user:id,name']);
        $this->store(
            (int) $booking->student_id,
            "booking:{$booking->getKey()}:completed",
            'booking_completed',
            'Session completed',
            'Your tutoring session is complete. If eligible, you can now leave a review.',
            (int) $booking->getKey(),
            null,
            ['Tutor' => $booking->tutorProfile->user->name, ...$this->bookingDetails($booking)],
            $this->frontendUrl("/bookings/{$booking->getKey()}"),
            'View booking',
        );
    }

    public function tutorApplicationApproved(TutorApplication $application): void
    {
        $this->store(
            (int) $application->user_id,
            "tutor-application:{$application->getKey()}:approved",
            'tutor_application_approved',
            'Tutor application approved',
            'Your tutor application has been approved. Tutor tools are now available.',
            null,
            (int) $application->getKey(),
            [],
            $this->frontendUrl('/tutor-application'),
            'View application',
        );
    }

    public function tutorApplicationRejected(TutorApplication $application): void
    {
        $this->store(
            (int) $application->user_id,
            "tutor-application:{$application->getKey()}:rejected",
            'tutor_application_rejected',
            'Tutor application update',
            'Your tutor application was not approved. Review the feedback in your application history.',
            null,
            (int) $application->getKey(),
            [],
            $this->frontendUrl('/tutor-application'),
            'View application',
        );
    }

    private function store(
        int $userId,
        string $eventKey,
        string $type,
        string $title,
        string $message,
        ?int $bookingId,
        ?int $tutorApplicationId,
        array $details,
        ?string $actionUrl,
        ?string $actionLabel,
    ): void {
        $timestamp = now();

        $inserted = DB::table('in_app_notifications')->insertOrIgnore([
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

        if ($inserted === 0) {
            return;
        }

        DB::afterCommit(fn () => $this->emailNotifications->send(
            recipientId: $userId,
            eventKey: $eventKey,
            type: $type,
            title: $title,
            message: $message,
            details: $details,
            actionUrl: $actionUrl,
            actionLabel: $actionLabel,
        ));
    }

    /**
     * @return array<string, string>
     */
    private function bookingDetails(Booking $booking): array
    {
        $startsAt = $booking->starts_at->setTimezone(config('app.timezone'));
        $endsAt = $booking->ends_at->setTimezone(config('app.timezone'));

        return [
            'Subject' => $booking->subject?->name ?? 'Subject unavailable',
            'Session' => $startsAt->format('D, M j, Y'),
            'Time' => $startsAt->format('g:i A T').' – '.$endsAt->format('g:i A T'),
        ];
    }

    private function frontendUrl(string $path): ?string
    {
        $baseUrl = rtrim((string) config('peer_tutoring.frontend_url'), '/');

        return $baseUrl === '' ? null : $baseUrl.$path;
    }
}
