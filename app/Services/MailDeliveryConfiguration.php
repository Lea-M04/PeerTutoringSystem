<?php

namespace App\Services;

class MailDeliveryConfiguration
{
    public function isUnavailable(): bool
    {
        $mailer = config('mail.default');

        if ($mailer === 'log') {
            return true;
        }

        if ($mailer === 'array') {
            return ! app()->environment('testing');
        }

        if ($mailer === 'failover') {
            return in_array('log', config('mail.mailers.failover.mailers', []), true);
        }

        if ($mailer !== 'smtp') {
            return false;
        }

        $smtpHost = config('mail.mailers.smtp.host');
        $smtpUrl = config('mail.mailers.smtp.url');
        $senderAddress = config('mail.from.address');
        $smtpUsername = config('mail.mailers.smtp.username');
        $smtpPassword = config('mail.mailers.smtp.password');

        if (filled($smtpUrl)) {
            return str_contains($smtpUrl, 'smtp.example.com')
                || blank($senderAddress)
                || $senderAddress === 'hello@example.com';
        }

        return blank($smtpHost)
            || in_array($smtpHost, ['127.0.0.1', 'localhost', 'smtp.example.com'], true)
            || blank($senderAddress)
            || $senderAddress === 'hello@example.com'
            || blank($smtpUsername)
            || blank($smtpPassword)
            || $smtpUsername === 'your-smtp-username'
            || $smtpPassword === 'your-smtp-password';
    }
}
