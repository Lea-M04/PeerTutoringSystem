<?php

namespace Tests\Feature;

use App\Models\InAppNotification;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_unauthenticated_users_receive_401_for_notification_endpoints(): void
    {
        $this->getJson('/api/notifications')->assertUnauthorized();
        $this->getJson('/api/notifications/unread-count')->assertUnauthorized();
        $this->postJson('/api/notifications/read-all')->assertUnauthorized();
        $this->postJson('/api/notifications/1/read')->assertUnauthorized();
    }

    public function test_authenticated_user_can_list_only_their_own_notifications(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $owned = InAppNotification::factory()->for($owner)->create([
            'event_key' => 'booking:10:requested',
            'booking_id' => null,
        ]);
        InAppNotification::factory()->for($otherUser)->create([
            'event_key' => 'booking:11:requested',
            'title' => 'Private notification',
        ]);

        $this->actingAs($owner)->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $owned->id)
            ->assertJsonPath('data.0.title', 'New tutoring request')
            ->assertJsonMissingPath('data.0.event_key')
            ->assertJsonMissingPath('data.0.user_id')
            ->assertJsonMissing(['title' => 'Private notification']);
    }

    public function test_user_can_mark_their_notification_as_read_but_cannot_read_another_users_notification(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $owned = InAppNotification::factory()->for($owner)->create(['event_key' => 'owned-event']);
        $private = InAppNotification::factory()->for($otherUser)->create(['event_key' => 'private-event']);

        $response = $this->actingAs($owner)->postJson("/api/notifications/{$owned->id}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $owned->id);
        $this->actingAs($owner)->postJson("/api/notifications/{$private->id}/read")->assertNotFound();

        $this->assertNotNull($response->json('data.read_at'));
        $this->assertNotNull($owned->fresh()->read_at);
        $this->assertNull($private->fresh()->read_at);
    }

    public function test_mark_all_read_updates_only_authenticated_users_unread_notifications(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $ownedUnread = InAppNotification::factory()->count(2)->for($owner)->sequence(
            ['event_key' => 'owner-event-1'],
            ['event_key' => 'owner-event-2'],
        )->create();
        $ownedRead = InAppNotification::factory()->for($owner)->create([
            'event_key' => 'owner-read-event',
            'read_at' => now()->subMinute(),
        ]);
        $otherUnread = InAppNotification::factory()->for($otherUser)->create(['event_key' => 'other-event']);

        $this->actingAs($owner)->postJson('/api/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('data.marked_read', 2);

        foreach ($ownedUnread as $notification) {
            $this->assertNotNull($notification->fresh()->read_at);
        }
        $this->assertSame($ownedRead->read_at->toISOString(), $ownedRead->fresh()->read_at->toISOString());
        $this->assertNull($otherUnread->fresh()->read_at);
    }

    public function test_unread_count_uses_persisted_records_for_only_authenticated_user(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        InAppNotification::factory()->count(2)->for($owner)->sequence(
            ['event_key' => 'unread-one', 'read_at' => null],
            ['event_key' => 'read-one', 'read_at' => now()],
        )->create();
        InAppNotification::factory()->for($otherUser)->create(['event_key' => 'other-unread']);

        $this->actingAs($owner)->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1);
    }

    public function test_notification_list_is_paginated_and_newest_first(): void
    {
        $user = User::factory()->create();
        $older = InAppNotification::factory()->for($user)->create(['event_key' => 'older-event', 'created_at' => now()->subMinute()]);
        $newer = InAppNotification::factory()->for($user)->create(['event_key' => 'newer-event', 'created_at' => now()]);

        $this->actingAs($user)->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.id', $newer->id)
            ->assertJsonPath('data.1.id', $older->id)
            ->assertJsonStructure(['data', 'links', 'meta']);
    }

    public function test_unknown_notification_id_returns_not_found(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/notifications/999999/read')->assertNotFound();
    }
}
