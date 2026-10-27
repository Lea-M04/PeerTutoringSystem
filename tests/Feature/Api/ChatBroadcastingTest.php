<?php

namespace Tests\Feature\Api;

use App\Events\Chat\MessageCreated;
use App\Events\Chat\ReadReceiptUpdated;
use App\Events\Chat\UnreadCountUpdated;
use App\Models\Conversation;
use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Broadcasting\BroadcastEvent;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ChatBroadcastingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_only_the_student_and_approved_tutor_can_authorize_a_conversation_channel(): void
    {
        $this->useReverbForChannelAuthorization();

        $student = $this->student();
        $tutor = $this->tutor();
        $otherStudent = $this->student();
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->where('name', Role::ADMIN)->value('id'));
        $admin->refresh();
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
        $anotherTutor = $this->tutor();
        $tutorStartedConversation = Conversation::query()->create([
            'student_id' => $tutor->getKey(),
            'tutor_profile_id' => $anotherTutor->tutorProfile->getKey(),
        ]);
        $payload = [
            'socket_id' => '123.456',
            'channel_name' => 'private-conversations.'.$conversation->getKey(),
        ];

        $this->actingAs($student, 'sanctum')->postJson('/broadcasting/auth', $payload)->assertOk()->assertJsonStructure(['auth']);
        $this->actingAs($tutor, 'sanctum')->postJson('/broadcasting/auth', $payload)->assertOk()->assertJsonStructure(['auth']);
        $payload['channel_name'] = 'private-conversations.'.$tutorStartedConversation->getKey();
        $this->actingAs($tutor, 'sanctum')->postJson('/broadcasting/auth', $payload)->assertOk()->assertJsonStructure(['auth']);
        $payload['channel_name'] = 'private-conversations.'.$conversation->getKey();
        $this->actingAs($otherStudent, 'sanctum')->postJson('/broadcasting/auth', $payload)->assertForbidden();
        $this->actingAs($admin, 'sanctum')->postJson('/broadcasting/auth', $payload)->assertForbidden();

        $tutor->tutorApplications()->where('status', TutorApplication::APPROVED)->update(['status' => TutorApplication::REJECTED]);
        $this->actingAs($tutor->fresh(), 'sanctum')->postJson('/broadcasting/auth', $payload)->assertForbidden();
    }

    public function test_user_chat_channel_is_self_only_and_excludes_admins(): void
    {
        $this->useReverbForChannelAuthorization();

        $student = $this->student();
        $otherStudent = $this->student();
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->where('name', Role::ADMIN)->value('id'));
        $admin->refresh();
        $payload = [
            'socket_id' => '123.456',
            'channel_name' => 'private-users.'.$student->getKey().'.chat',
        ];

        $this->actingAs($student, 'sanctum')->postJson('/broadcasting/auth', $payload)->assertOk();
        $this->actingAs($otherStudent, 'sanctum')->postJson('/broadcasting/auth', $payload)->assertForbidden();
        $this->actingAs($admin, 'sanctum')->postJson('/broadcasting/auth', $payload)->assertForbidden();
    }

    public function test_chat_events_use_private_channels_and_only_safe_broadcast_payloads(): void
    {
        $message = [
            'id' => 41,
            'client_message_id' => 'client-41',
            'body' => 'Persisted message',
            'read_at' => null,
            'created_at' => '2026-10-26T10:00:00.000Z',
            'sender' => ['id' => 7, 'name' => 'Student', 'first_name' => 'Student', 'last_name' => 'One'],
            'attachments' => [['id' => 2, 'url' => '/api/message-attachments/2', 'mime_type' => 'image/png']],
        ];
        $messageEvent = new MessageCreated(9, $message);
        $readEvent = new ReadReceiptUpdated(9, 8, 41, '2026-10-26T10:02:00.000Z');
        $unreadEvent = new UnreadCountUpdated(7, 9);

        $this->assertContainsOnlyInstancesOf(PrivateChannel::class, $messageEvent->broadcastOn());
        $this->assertSame('private-conversations.9', $messageEvent->broadcastOn()[0]->name);
        $this->assertSame(['conversation_id' => 9, 'message' => $message], $messageEvent->broadcastWith());
        $this->assertSame(['conversation_id' => 9, 'reader_id' => 8, 'read_through_message_id' => 41, 'read_at' => '2026-10-26T10:02:00.000Z'], $readEvent->broadcastWith());
        $this->assertSame('private-users.7.chat', $unreadEvent->broadcastOn()[0]->name);
        $this->assertSame(['conversation_id' => 9], $unreadEvent->broadcastWith());
        $this->assertInstanceOf(ShouldDispatchAfterCommit::class, $messageEvent);
        $this->assertInstanceOf(ShouldDispatchAfterCommit::class, $readEvent);
        $this->assertInstanceOf(ShouldDispatchAfterCommit::class, $unreadEvent);
        $this->assertArrayNotHasKey('storage_path', $messageEvent->broadcastWith()['message']['attachments'][0]);
    }

    public function test_chat_broadcast_events_are_queued_after_a_successful_commit(): void
    {
        Queue::fake();

        DB::transaction(function (): void {
            foreach ($this->chatBroadcastEvents() as $event) {
                event($event);
            }

            Queue::assertNothingPushed();
        });

        Queue::assertPushedTimes(BroadcastEvent::class, 3);
    }

    public function test_chat_broadcast_events_are_not_queued_when_the_transaction_rolls_back(): void
    {
        Queue::fake();

        DB::beginTransaction();
        try {
            foreach ($this->chatBroadcastEvents() as $event) {
                event($event);
            }

            Queue::assertNothingPushed();
        } finally {
            DB::rollBack();
        }

        Queue::assertNothingPushed();
    }

    /** @return array<int, MessageCreated|ReadReceiptUpdated|UnreadCountUpdated> */
    private function chatBroadcastEvents(): array
    {
        return [
            new MessageCreated(9, ['id' => 41]),
            new ReadReceiptUpdated(9, 8, 41, '2026-10-26T10:02:00.000Z'),
            new UnreadCountUpdated(7, 9),
        ];
    }

    private function student(): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));

        return $user->fresh();
    }

    private function tutor(): User
    {
        $user = User::factory()->create();
        $user->roles()->attach([
            Role::query()->where('name', Role::STUDENT)->value('id'),
            Role::query()->where('name', Role::TUTOR)->value('id'),
        ]);
        $user->tutorProfile()->create([]);
        $user->tutorApplications()->create(['motivation' => 'I enjoy helping fellow students.'])
            ->forceFill(['status' => TutorApplication::APPROVED])->save();

        return $user->fresh();
    }

    private function useReverbForChannelAuthorization(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => 'test-app',
        ]);

        require base_path('routes/channels.php');
    }
}
