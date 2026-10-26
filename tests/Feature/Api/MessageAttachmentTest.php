<?php

namespace Tests\Feature\Api;

use App\Models\Conversation;
use App\Models\MessageAttachment;
use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class MessageAttachmentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function participant(string $role, bool $approvedTutor = false): User
    {
        $user = User::factory()->create();
        $roleIds = [Role::query()->where('name', $role)->value('id')];
        if ($approvedTutor) {
            $roleIds[] = Role::query()->where('name', Role::STUDENT)->value('id');
        }
        $user->roles()->attach(array_unique($roleIds));
        if ($approvedTutor) {
            $user->tutorProfile()->create([]);
            $user->tutorApplications()->create(['motivation' => 'I enjoy helping fellow students.'])
                ->forceFill(['status' => TutorApplication::APPROVED])->save();
        }

        return $user->fresh();
    }

    public function test_valid_image_is_stored_privately_and_retrieved_only_by_participants(): void
    {
        Storage::fake('private');
        $student = $this->participant(Role::STUDENT);
        $tutor = $this->participant(Role::TUTOR, true);
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);

        $payload = [
            'client_message_id' => 'eb7a3006-9d53-4d10-a0e9-0a32f87d33f6',
            'body' => 'Diagram attached',
            'attachment' => UploadedFile::fake()->image('original-name.png', 24, 16),
        ];
        $response = $this->actingAs($student)->postJson("/api/conversations/{$conversation->getKey()}/messages", $payload)->assertCreated()
            ->assertJsonPath('data.body', 'Diagram attached')
            ->assertJsonMissingPath('data.attachments.0.storage_path');
        $this->actingAs($student)->postJson("/api/conversations/{$conversation->getKey()}/messages", $payload)
            ->assertOk()
            ->assertJsonPath('data.id', $response->json('data.id'));

        $attachment = MessageAttachment::query()->firstOrFail();
        $this->assertDatabaseCount('messages', 1);
        $this->assertDatabaseCount('message_attachments', 1);
        Storage::disk('private')->assertExists($attachment->storage_path);
        $this->assertStringNotContainsString('original-name', $attachment->storage_path);
        $this->assertSame('image/png', $attachment->mime_type);
        $this->assertLessThanOrEqual(5 * 1024 * 1024, $attachment->size_bytes);

        $downloadResponse = $this->actingAs($tutor)->get($response->json('data.attachments.0.url'))
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $cacheDirectives = array_map(
            'trim',
            explode(',', strtolower($downloadResponse->headers->get('Cache-Control'))),
        );
        $this->assertEqualsCanonicalizing(['private', 'no-store'], $cacheDirectives);
        $this->actingAs($this->participant(Role::STUDENT))->get($response->json('data.attachments.0.url'))->assertForbidden();
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->where('name', Role::ADMIN)->value('id'));
        $this->actingAs($admin)->get($response->json('data.attachments.0.url'))->assertForbidden();
    }

    public function test_spoofed_and_oversized_images_are_rejected_without_creating_messages(): void
    {
        Storage::fake('private');
        $student = $this->participant(Role::STUDENT);
        $tutor = $this->participant(Role::TUTOR, true);
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);

        $this->actingAs($student)->postJson("/api/conversations/{$conversation->getKey()}/messages", [
            'client_message_id' => 'eb7a3006-9d53-4d10-a0e9-0a32f87d33f6',
            'attachment' => UploadedFile::fake()->createWithContent('spoofed.jpg', 'not an image'),
        ])->assertUnprocessable()->assertJsonValidationErrors('attachment');
        $this->actingAs($student)->postJson("/api/conversations/{$conversation->getKey()}/messages", [
            'client_message_id' => 'ae13e014-c0a4-4f6e-b7c8-7163da45077e',
            'attachment' => UploadedFile::fake()->createWithContent(
                'unsupported.gif',
                base64_decode('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='),
            ),
        ])->assertUnprocessable()->assertJsonValidationErrors('attachment');
        $this->actingAs($student)->postJson("/api/conversations/{$conversation->getKey()}/messages", [
            'client_message_id' => '73f65f3c-8b72-43d5-a7c7-7ffca81928ba',
            'attachment' => UploadedFile::fake()->create('oversized.png', 5121, 'image/png'),
        ])->assertUnprocessable()->assertJsonValidationErrors('attachment');

        $this->assertDatabaseCount('messages', 0);
        Storage::disk('private')->assertDirectoryEmpty('chat/'.$conversation->getKey());
    }

    public function test_images_over_dimension_or_pixel_limits_are_rejected(): void
    {
        Storage::fake('private');
        $student = $this->participant(Role::STUDENT);
        $tutor = $this->participant(Role::TUTOR, true);
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
        $url = "/api/conversations/{$conversation->getKey()}/messages";

        $this->actingAs($student)->postJson($url, [
            'client_message_id' => 'dd9e5083-3c8a-47a5-9e15-843ac48e7551',
            'attachment' => UploadedFile::fake()->image('too-wide.png', 6001, 1),
        ])->assertUnprocessable()->assertJsonValidationErrors('attachment');

        $this->actingAs($student)->postJson($url, [
            'client_message_id' => 'c6936a07-fb87-42ed-b15e-d3d587779a22',
            'attachment' => UploadedFile::fake()->image('too-many-pixels.png', 4000, 3001),
        ])->assertUnprocessable()->assertJsonValidationErrors('attachment');

        $this->assertDatabaseCount('messages', 0);
        Storage::disk('private')->assertDirectoryEmpty('chat/'.$conversation->getKey());
    }

    public function test_private_image_is_removed_when_database_persistence_fails(): void
    {
        Storage::fake('private');
        $student = $this->participant(Role::STUDENT);
        RateLimiter::clear('chat-image-uploads:'.$student->getAuthIdentifier());
        $tutor = $this->participant(Role::TUTOR, true);
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
        DB::statement("CREATE TRIGGER fail_message_insert BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'Simulated persistence failure.'); END;");

        $this->actingAs($student)->postJson("/api/conversations/{$conversation->getKey()}/messages", [
            'client_message_id' => '17831d19-c088-4cdf-b3fb-761ad4098509',
            'body' => 'Image upload should roll back.',
            'attachment' => UploadedFile::fake()->image('temporary.png', 24, 16),
        ])->assertServerError();

        $this->assertDatabaseCount('messages', 0);
        Storage::disk('private')->assertDirectoryEmpty('chat/'.$conversation->getKey());
        $this->assertSame(1, RateLimiter::attempts('chat-image-uploads:'.$student->getAuthIdentifier()));
    }

    public function test_image_upload_limit_is_per_user_and_does_not_limit_text_messages(): void
    {
        Storage::fake('private');
        $this->freezeTime();
        $student = $this->participant(Role::STUDENT);
        RateLimiter::clear('chat-image-uploads:'.$student->getAuthIdentifier());
        $tutor = $this->participant(Role::TUTOR, true);
        $anotherTutor = $this->participant(Role::TUTOR, true);
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
        $anotherConversationForSameStudent = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $anotherTutor->tutorProfile->getKey(),
        ]);

        $firstClientMessageId = (string) Str::uuid();
        $firstMessageId = null;

        foreach (range(1, 30) as $number) {
            $response = $this->actingAs($student)->postJson("/api/conversations/{$conversation->getKey()}/messages", [
                'client_message_id' => $number === 1 ? $firstClientMessageId : (string) Str::uuid(),
                'attachment' => UploadedFile::fake()->image("diagram-{$number}.png", 2, 2),
            ])->assertCreated();

            if ($number === 1) {
                $firstMessageId = $response->json('data.id');
            }
        }

        $this->actingAs($student)->postJson("/api/conversations/{$conversation->getKey()}/messages", [
            'client_message_id' => $firstClientMessageId,
            'attachment' => UploadedFile::fake()->image('retried-diagram.png', 2, 2),
        ])->assertOk()->assertJsonPath('data.id', $firstMessageId);

        $this->actingAs($student)->postJson("/api/conversations/{$conversation->getKey()}/messages", [
            'client_message_id' => (string) Str::uuid(),
            'attachment' => UploadedFile::fake()->image('another-diagram.png', 2, 2),
        ])->assertTooManyRequests()->assertHeader('Retry-After');

        $this->actingAs($student)->postJson("/api/conversations/{$anotherConversationForSameStudent->getKey()}/messages", [
            'client_message_id' => (string) Str::uuid(),
            'attachment' => UploadedFile::fake()->image('other-conversation.png', 2, 2),
        ])->assertTooManyRequests()->assertHeader('Retry-After');

        $this->actingAs($student)->postJson("/api/conversations/{$conversation->getKey()}/messages", [
            'client_message_id' => (string) Str::uuid(),
            'body' => 'Text remains available after the image threshold.',
        ])->assertCreated();

        $anotherStudent = $this->participant(Role::STUDENT);
        $anotherConversation = Conversation::query()->create([
            'student_id' => $anotherStudent->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
        $this->actingAs($anotherStudent)->postJson("/api/conversations/{$anotherConversation->getKey()}/messages", [
            'client_message_id' => (string) Str::uuid(),
            'attachment' => UploadedFile::fake()->image('other-user.png', 2, 2),
        ])->assertCreated();
        $this->assertSame(1, RateLimiter::attempts('chat-image-uploads:'.$anotherStudent->getAuthIdentifier()));

        $this->travel(61)->seconds();

        $this->actingAs($student)->postJson("/api/conversations/{$anotherConversationForSameStudent->getKey()}/messages", [
            'client_message_id' => (string) Str::uuid(),
            'attachment' => UploadedFile::fake()->image('after-window.png', 2, 2),
        ])->assertCreated();

        $this->assertDatabaseCount('messages', 33);
        $this->assertDatabaseCount('message_attachments', 32);
        $this->assertSame(1, RateLimiter::attempts('chat-image-uploads:'.$student->getAuthIdentifier()));
        $this->assertSame(0, RateLimiter::attempts('chat-image-uploads:'.$anotherStudent->getAuthIdentifier()));
    }

    public function test_unauthenticated_and_inactive_users_cannot_upload_images(): void
    {
        Storage::fake('private');
        $student = $this->participant(Role::STUDENT);
        $inactiveStudent = $this->participant(Role::STUDENT);
        RateLimiter::clear('chat-image-uploads:'.$inactiveStudent->getAuthIdentifier());
        $inactiveStudent->forceFill(['is_active' => false])->save();
        $tutor = $this->participant(Role::TUTOR, true);
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
        $payload = [
            'client_message_id' => (string) Str::uuid(),
            'attachment' => UploadedFile::fake()->image('diagram.png', 2, 2),
        ];
        $url = "/api/conversations/{$conversation->getKey()}/messages";

        $this->postJson($url, $payload)->assertUnauthorized();
        $this->actingAs($inactiveStudent)->postJson($url, $payload)->assertForbidden();

        $this->assertDatabaseCount('messages', 0);
        $this->assertSame(0, RateLimiter::attempts('chat-image-uploads:'.$inactiveStudent->getAuthIdentifier()));
        Storage::disk('private')->assertDirectoryEmpty('chat/'.$conversation->getKey());
    }
}
