<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\RequestPasswordResetLinkRequest;
use App\Http\Requests\ResetPasswordRequest;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Throwable;

class PasswordResetController extends Controller
{
    public function requestLink(RequestPasswordResetLinkRequest $request): JsonResponse
    {
        if ($this->emailDeliveryIsUnavailable()) {
            return response()->json([
                'message' => 'Password reset email delivery is not configured. Please ask the project administrator to configure an email provider before requesting a reset link.',
            ], 503);
        }

        try {
            Password::sendResetLink($request->validated());
        } catch (Throwable $exception) {
            // Keep the public response generic and avoid logging recipient or token data.
            Log::warning('Password reset email delivery failed.', [
                'exception_type' => $exception::class,
            ]);
        }

        return response()->json([
            'message' => 'Your request was received, but this page cannot confirm delivery. If this address matches an account and the mail provider accepts the message, reset instructions should arrive shortly. If no email arrives, ask the project administrator to verify the mail settings.',
        ], 202);
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset($request->safe()->only(['email', 'password', 'token']), function ($user, string $password): void {
            $user->forceFill([
                'password' => $password,
                'remember_token' => Str::random(60),
            ])->save();

            event(new PasswordReset($user));
        });

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => __($status),
                'errors' => ['email' => [__($status)]],
            ], 422);
        }

        return response()->json(['message' => 'Your password has been reset. You can now sign in.']);
    }

    private function emailDeliveryIsUnavailable(): bool
    {
        $mailer = config('mail.default');

        if ($mailer === 'log') {
            return true;
        }

        if ($mailer === 'array') {
            return ! app()->environment('testing');
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

        if ($mailer === 'failover' && in_array('log', config('mail.mailers.failover.mailers', []), true)) {
            return true;
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
