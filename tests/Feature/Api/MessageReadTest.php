<?php

namespace Tests\Feature\Api;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageReadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_recipient_can_mark_only_received_messages_read_idempotently(): void
    {
        $student = User::factory()->create();
        $student->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $tutor = User::factory()->create();
        $tutor->roles()->attach([
            Role::query()->where('name', Role::STUDENT)->value('id'),
            Role::query()->where('name', Role::TUTOR)->value('id'),
        ]);
        $tutor->tutorProfile()->create([]);
        $tutor->tutorApplications()->create(['motivation' => 'I enjoy helping fellow students.'])
            ->forceFill(['status' => TutorApplication::APPROVED])->save();
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
        $received = $conversation->messages()->create([
            'sender_id' => $student->getKey(),
            'client_message_id' => 'eb7a3006-9d53-4d10-a0e9-0a32f87d33f6',
            'body' => 'Please review this note.',
        ]);
        $sent = $conversation->messages()->create([
            'sender_id' => $tutor->getKey(),
            'client_message_id' => '73f65f3c-8b72-43d5-a7c7-7ffca81928ba',
            'body' => 'I will take a look.',
        ]);

        $payload = ['message_id' => $received->getKey()];
        $this->actingAs($tutor)->postJson("/api/conversations/{$conversation->getKey()}/read", $payload)
            ->assertOk()->assertJsonPath('data.marked_read', 1);
        $this->actingAs($tutor)->postJson("/api/conversations/{$conversation->getKey()}/read", $payload)
            ->assertOk()->assertJsonPath('data.marked_read', 0);
        $this->actingAs($tutor)->postJson("/api/conversations/{$conversation->getKey()}/read", [
            'message_id' => $sent->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('message_id');

        $otherStudent = User::factory()->create();
        $otherStudent->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $this->actingAs($otherStudent)->postJson("/api/conversations/{$conversation->getKey()}/read", $payload)->assertForbidden();

        $anotherTutor = User::factory()->create();
        $anotherTutor->roles()->attach([
            Role::query()->where('name', Role::STUDENT)->value('id'),
            Role::query()->where('name', Role::TUTOR)->value('id'),
        ]);
        $anotherTutor->tutorProfile()->create([]);
        $anotherTutor->tutorApplications()->create(['motivation' => 'I enjoy helping fellow students.'])
            ->forceFill(['status' => TutorApplication::APPROVED])->save();
        $anotherConversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $anotherTutor->tutorProfile->getKey(),
        ]);
        $unrelatedMessage = $anotherConversation->messages()->create([
            'sender_id' => $student->getKey(),
            'client_message_id' => 'f934af20-49a3-4c8a-9ec0-310a012053fc',
            'body' => 'Belongs to another conversation.',
        ]);
        $foreignIdResponse = $this->actingAs($tutor)->postJson("/api/conversations/{$conversation->getKey()}/read", [
            'message_id' => $unrelatedMessage->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('message_id');
        $missingIdResponse = $this->actingAs($tutor)->postJson("/api/conversations/{$conversation->getKey()}/read", [
            'message_id' => PHP_INT_MAX,
        ])->assertUnprocessable()->assertJsonValidationErrors('message_id');

        $this->assertSame($foreignIdResponse->json('errors'), $missingIdResponse->json('errors'));
        $this->assertNotNull($received->fresh()->read_at);
        $this->assertNull($sent->fresh()->read_at);
        $this->assertSame(2, Message::query()->where('conversation_id', $conversation->getKey())->count());
    }
}
