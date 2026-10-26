<?php

namespace App\Services;

use App\Mail\BusinessEventMail;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class NotificationEmailService
{
    public function __construct(private MailDeliveryConfiguration $mailConfiguration) {}

    /**
     * @param  array<string, string>  $details
     */
    public function send(
        int $recipientId,
        string $eventKey,
        string $type,
        string $title,
        string $message,
        array $details,
        ?string $actionUrl,
        ?string $actionLabel,
    ): void {
        try {
            if ($this->mailConfiguration->isUnavailable()) {
                Log::notice('Notification email skipped because mail delivery is not configured.', [
                    'event_key' => $eventKey,
                    'notification_type' => $type,
                ]);

                return;
            }

            $recipient = User::query()->find($recipientId);

            if ($recipient === null) {
                Log::warning('Notification email recipient no longer exists.', [
                    'event_key' => $eventKey,
                    'notification_type' => $type,
                ]);

                return;
            }

            Mail::to($recipient->email)->send(new BusinessEventMail(
                recipientName: $recipient->name,
                title: $title,
                body: $message,
                details: $details,
                actionUrl: $actionUrl,
                actionLabel: $actionLabel,
            ));
        } catch (Throwable $exception) {
            Log::warning('Notification email delivery failed.', [
                'event_key' => $eventKey,
                'notification_type' => $type,
                'exception_type' => $exception::class,
            ]);
        }
    }
}
