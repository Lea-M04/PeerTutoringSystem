<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\RequestPasswordResetLinkRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Services\MailDeliveryConfiguration;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Throwable;

class PasswordResetController extends Controller
{
    public function requestLink(RequestPasswordResetLinkRequest $request, MailDeliveryConfiguration $mailConfiguration): JsonResponse
    {
        if ($mailConfiguration->isUnavailable()) {
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
}
