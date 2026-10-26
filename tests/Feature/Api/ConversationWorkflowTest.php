<?php

namespace Tests\Feature\Api;

use App\Models\Booking;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Role;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConversationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function student(): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));

        return $user;
    }

    private function tutor(bool $approved = true): User
    {
        $user = User::factory()->create();
        $user->roles()->attach([
            Role::query()->where('name', Role::STUDENT)->value('id'),
            Role::query()->where('name', Role::TUTOR)->value('id'),
        ]);
        $user->tutorProfile()->create([]);
        $application = $user->tutorApplications()->create(['motivation' => 'I enjoy helping fellow students.']);
        if ($approved) {
            $application->forceFill(['status' => TutorApplication::APPROVED])->save();
        }

        return $user->fresh();
    }

    public function test_student_creates_or_finds_one_conversation_with_an_approved_tutor(): void
    {
        $student = $this->student();
        $tutor = $this->tutor();

        $created = $this->actingAs($student)->postJson('/api/conversations', [
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ])->assertCreated();
        $this->actingAs($student)->postJson('/api/conversations', [
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ])->assertOk()->assertJsonPath('data.id', $created->json('data.id'));

        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseHas('conversations', [
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
    }

    public function test_unapproved_tutor_and_tutor_initiator_are_forbidden(): void
    {
        $student = $this->student();
        $unapprovedTutor = $this->tutor(false);
        $approvedTutor = $this->tutor();
        $anotherApprovedTutor = $this->tutor();

        $this->actingAs($student)->postJson('/api/conversations', [
            'tutor_profile_id' => $unapprovedTutor->tutorProfile->getKey(),
        ])->assertForbidden();
        $this->actingAs($approvedTutor)->postJson('/api/conversations', [
            'tutor_profile_id' => $anotherApprovedTutor->tutorProfile->getKey(),
        ])->assertForbidden();
        $this->assertDatabaseCount('conversations', 0);
    }

    public function test_users_can_only_list_and_read_their_own_pair_conversations(): void
    {
        $student = $this->student();
        $otherStudent = $this->student();
        $tutor = $this->tutor();
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);

        $this->actingAs($student)->getJson('/api/conversations')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($tutor)->getJson("/api/conversations/{$conversation->getKey()}/messages")->assertOk();
        $this->actingAs($otherStudent)->getJson('/api/conversations')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($otherStudent)->getJson("/api/conversations/{$conversation->getKey()}/messages")->assertForbidden();
        $this->actingAs($otherStudent)->postJson("/api/conversations/{$conversation->getKey()}/messages", [
            'client_message_id' => 'eb7a3006-9d53-4d10-a0e9-0a32f87d33f6',
            'body' => 'Unauthorized message',
        ])->assertForbidden();
        $this->assertDatabaseCount('messages', 0);
    }

    public function test_admins_and_inactive_accounts_cannot_access_chat(): void
    {
        $student = $this->student();
        $tutor = $this->tutor();
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->where('name', Role::ADMIN)->value('id'));
        $inactiveStudent = $this->student();
        $inactiveStudent->forceFill(['is_active' => false])->save();

        $this->actingAs($admin)->getJson('/api/conversations')->assertForbidden();
        $this->actingAs($admin)->getJson("/api/conversations/{$conversation->getKey()}/messages")->assertForbidden();
        $this->actingAs($inactiveStudent)->getJson('/api/conversations')->assertForbidden();
        $this->actingAs($inactiveStudent)->getJson("/api/conversations/{$conversation->getKey()}/messages")->assertForbidden();
    }

    public function test_unread_message_count_is_total_and_limited_to_received_unread_messages(): void
    {
        $student = $this->student();
        $otherStudent = $this->student();
        $tutor = $this->tutor();
        $secondTutor = $this->tutor();
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
        $secondConversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $secondTutor->tutorProfile->getKey(),
        ]);
        $otherConversation = Conversation::query()->create([
            'student_id' => $otherStudent->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);

        Message::query()->create([
            'conversation_id' => $conversation->getKey(),
            'sender_id' => $tutor->getKey(),
            'client_message_id' => 'e57d12df-c947-4a4a-a655-03506e7bbad8',
            'body' => 'Unread from tutor one',
        ]);
        Message::query()->create([
            'conversation_id' => $conversation->getKey(),
            'sender_id' => $student->getKey(),
            'client_message_id' => '660ca994-c1e5-46f8-b19f-913d9cf5cc57',
            'body' => 'My own unread message is excluded',
        ]);
        Message::query()->create([
            'conversation_id' => $secondConversation->getKey(),
            'sender_id' => $secondTutor->getKey(),
            'client_message_id' => 'ea63e42b-8e7e-4cf0-886b-a51fda509f52',
            'body' => 'Read from tutor two',
            'read_at' => now(),
        ]);
        Message::query()->create([
            'conversation_id' => $secondConversation->getKey(),
            'sender_id' => $secondTutor->getKey(),
            'client_message_id' => 'd46c9568-cfe0-4331-b48b-fd4cd5e92ad5',
            'body' => 'Unread from tutor two',
        ]);
        Message::query()->create([
            'conversation_id' => $otherConversation->getKey(),
            'sender_id' => $tutor->getKey(),
            'client_message_id' => 'a4637b12-2583-4825-88c2-9474973c649e',
            'body' => 'Unread by somebody else',
        ]);

        $this->getJson('/api/conversations/unread-count')->assertUnauthorized();
        $this->actingAs($student)->getJson('/api/conversations/unread-count')
            ->assertOk()
            ->assertExactJson(['data' => ['unread_count' => 2]]);

        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->where('name', Role::ADMIN)->value('id'));
        $this->actingAs($admin)->getJson('/api/conversations/unread-count')->assertForbidden();
    }

    public function test_booking_rejection_cancellation_and_completion_do_not_revoke_chat_access(): void
    {
        $student = $this->student();
        $tutor = $this->tutor();
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);

        foreach ([Booking::REJECTED, Booking::CANCELLED, Booking::COMPLETED] as $index => $status) {
            $availability = $tutor->tutorProfile->availabilities()->create([
                'starts_at' => now()->addDays(2 + $index),
                'ends_at' => now()->addDays(2 + $index)->addHour(),
            ]);
            $booking = Booking::factory()->forAvailability($availability)->create([
                'student_id' => $student->getKey(),
                'status' => $status,
            ]);

            $this->actingAs($student)->getJson("/api/conversations/{$conversation->getKey()}/messages")->assertOk();
            $this->assertDatabaseHas('bookings', ['id' => $booking->getKey(), 'status' => $status]);
        }

        $this->assertDatabaseHas('conversations', ['id' => $conversation->getKey()]);
    }

    public function test_blank_text_is_rejected_and_sender_identity_comes_from_authentication(): void
    {
        $student = $this->student();
        $tutor = $this->tutor();
        $conversation = Conversation::query()->create([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $tutor->tutorProfile->getKey(),
        ]);
        $url = "/api/conversations/{$conversation->getKey()}/messages";

        $this->actingAs($student)->postJson($url, [
            'client_message_id' => 'eb7a3006-9d53-4d10-a0e9-0a32f87d33f6',
            'body' => '   ',
        ])->assertUnprocessable()->assertJsonValidationErrors('body');

        $this->actingAs($student)->postJson($url, [
            'client_message_id' => '73f65f3c-8b72-43d5-a7c7-7ffca81928ba',
            'body' => 'Authenticated sender',
            'sender_id' => $tutor->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('sender_id');

        $created = $this->actingAs($student)->postJson($url, [
            'client_message_id' => 'b27cf1bc-9d3a-4cf9-82b0-cf0ef7cd9b8c',
            'body' => 'Authenticated sender',
        ])->assertCreated()->assertJsonPath('data.sender.id', $student->getKey());

        $retried = $this->actingAs($student)->postJson($url, [
            'client_message_id' => 'b27cf1bc-9d3a-4cf9-82b0-cf0ef7cd9b8c',
            'body' => 'Authenticated sender',
        ])->assertOk()->assertJsonPath('data.id', $created->json('data.id'));

        $this->assertDatabaseCount('messages', 1);
        $this->assertSame($created->json('data.id'), $retried->json('data.id'));
    }
}
