<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_link_request_returns_the_same_neutral_response_for_known_and_unknown_emails(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'account@example.test']);

        $known = $this->postJson('/api/password/forgot', ['email' => $user->email]);
        $unknown = $this->postJson('/api/password/forgot', ['email' => 'missing@example.test']);

        $known->assertAccepted()->assertExactJson($unknown->json());
        $this->assertStringContainsString('cannot confirm delivery', $known->json('message'));
        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_log_mailer_reports_configuration_unavailable_without_account_enumeration(): void
    {
        config(['mail.default' => 'log']);
        User::factory()->create(['email' => 'account@example.test']);

        $known = $this->postJson('/api/password/forgot', ['email' => 'account@example.test']);
        $unknown = $this->postJson('/api/password/forgot', ['email' => 'missing@example.test']);

        $known->assertServiceUnavailable()->assertExactJson($unknown->json());
        $this->assertStringContainsString('email delivery is not configured', strtolower($known->json('message')));
    }

    public function test_placeholder_smtp_settings_are_reported_as_unconfigured(): void
    {
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => 'smtp.example.com',
            'mail.mailers.smtp.url' => null,
            'mail.mailers.smtp.username' => 'your-smtp-username',
            'mail.mailers.smtp.password' => 'your-smtp-password',
            'mail.from.address' => 'notifications@example.com',
        ]);

        $response = $this->postJson('/api/password/forgot', ['email' => 'person@example.test']);

        $response->assertServiceUnavailable();
        $this->assertStringContainsString('not configured', $response->json('message'));
    }

    public function test_valid_reset_link_uses_frontend_url_and_never_returns_a_token(): void
    {
        Notification::fake();
        config(['peer_tutoring.frontend_url' => 'http://localhost:5173']);
        $user = User::factory()->create(['email' => 'reset@example.test']);

        $response = $this->postJson('/api/password/forgot', ['email' => $user->email])->assertAccepted();

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification): bool {
            $url = $notification->toMail(new User)->actionUrl;

            return str_starts_with($url, 'http://localhost:5173/reset-password?')
                && str_contains($url, 'token='.$notification->token);
        });
        $response->assertJsonMissingPath('data.token')->assertJsonMissingPath('token');
    }

    public function test_valid_token_resets_password_and_cannot_be_used_again(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'reset-once@example.test']);
        $this->postJson('/api/password/forgot', ['email' => $user->email])->assertAccepted();
        $notification = Notification::sent($user, ResetPassword::class)->first();
        $payload = [
            'email' => $user->email,
            'token' => $notification->token,
            'password' => 'A-new-secure-password-123',
            'password_confirmation' => 'A-new-secure-password-123',
        ];

        $this->postJson('/api/password/reset', $payload)->assertOk()->assertJsonMissingPath('password');
        $this->assertTrue(Hash::check('A-new-secure-password-123', $user->fresh()->password));
        $this->postJson('/api/password/reset', $payload)->assertUnprocessable();
    }

    public function test_invalid_expired_and_mismatched_reset_requests_are_rejected(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'expired@example.test']);
        $this->postJson('/api/password/reset', [
            'email' => $user->email, 'token' => 'invalid-token',
            'password' => 'A-new-secure-password-123', 'password_confirmation' => 'A-new-secure-password-123',
        ])->assertUnprocessable();

        $this->postJson('/api/password/forgot', ['email' => $user->email])->assertAccepted();
        $notification = Notification::sent($user, ResetPassword::class)->first();
        $this->travel(61)->minutes();
        $this->postJson('/api/password/reset', [
            'email' => $user->email, 'token' => $notification->token,
            'password' => 'A-new-secure-password-123', 'password_confirmation' => 'A-new-secure-password-123',
        ])->assertUnprocessable();

        $this->postJson('/api/password/reset', [
            'email' => $user->email, 'token' => $notification->token,
            'password' => 'A-new-secure-password-123', 'password_confirmation' => 'different-password-123',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_reset_payload_requires_a_confirmed_password_of_at_least_twelve_characters(): void
    {
        $this->postJson('/api/password/reset', [
            'email' => 'person@example.test', 'token' => 'token',
            'password' => 'short', 'password_confirmation' => 'different',
        ])->assertUnprocessable()->assertJsonValidationErrors(['password']);
    }

    public function test_reset_link_requests_are_rate_limited(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'throttled@example.test']);

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/password/forgot', ['email' => $user->email])->assertAccepted();
        }

        $this->postJson('/api/password/forgot', ['email' => $user->email])->assertTooManyRequests();
    }
}
