<?php

namespace Tests\Feature\Api;

use App\Models\Booking;
use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TutorAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->travelTo('2030-01-01 08:00:00');
    }

    private function approvedTutor(): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $user->roles()->attach(Role::query()->where('name', Role::TUTOR)->value('id'));
        $profile = $user->tutorProfile()->create([]);
        $application = $user->tutorApplications()->create(['motivation' => 'I enjoy helping peers.']);
        $application->forceFill(['status' => TutorApplication::APPROVED])->save();

        return $user->fresh()->setRelation('tutorProfile', $profile);
    }

    private function addActiveOffering(User $tutor): void
    {
        $subject = Subject::factory()->create(['is_active' => true]);
        $tutor->tutorProfile->offerings()->create(['subject_id' => $subject->id]);
    }

    public function test_approved_tutor_can_create_list_update_and_delete_their_own_intervals(): void
    {
        $tutor = $this->approvedTutor();
        $payload = ['starts_at' => '2030-01-02T09:00:00Z', 'ends_at' => '2030-01-02T10:00:00Z'];

        $created = $this->actingAs($tutor)->postJson('/api/tutor-profile/availability', $payload)
            ->assertCreated()
            ->assertJsonPath('data.starts_at', '2030-01-02T09:00:00.000000Z')
            ->assertJsonPath('data.ends_at', '2030-01-02T10:00:00.000000Z');
        $availabilityId = $created->json('data.id');
        $this->assertDatabaseHas('tutor_availabilities', [
            'id' => $availabilityId,
            'tutor_profile_id' => $tutor->tutorProfile->id,
            'starts_at' => '2030-01-02 09:00:00',
            'ends_at' => '2030-01-02 10:00:00',
        ]);

        $this->getJson('/api/tutor-profile/availability')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $availabilityId);
        $this->putJson("/api/tutor-profile/availability/{$availabilityId}", [
            'starts_at' => '2030-01-02T11:00:00Z',
            'ends_at' => '2030-01-02T12:00:00Z',
        ])->assertOk()->assertJsonPath('data.starts_at', '2030-01-02T11:00:00.000000Z');
        $this->assertDatabaseHas('tutor_availabilities', ['id' => $availabilityId, 'starts_at' => '2030-01-02 11:00:00']);

        $this->deleteJson("/api/tutor-profile/availability/{$availabilityId}")->assertNoContent();
        $this->assertDatabaseMissing('tutor_availabilities', ['id' => $availabilityId]);
    }

    public function test_explicit_local_timezone_offset_round_trips_through_create_edit_and_reload(): void
    {
        $tutor = $this->approvedTutor();
        $created = $this->actingAs($tutor)->postJson('/api/tutor-profile/availability', [
            'starts_at' => '2030-01-02T21:00:00+01:00',
            'ends_at' => '2030-01-02T22:00:00+01:00',
        ])->assertCreated()
            ->assertJsonPath('data.starts_at', '2030-01-02T20:00:00.000000Z')
            ->assertJsonPath('data.ends_at', '2030-01-02T21:00:00.000000Z');

        $availabilityId = $created->json('data.id');
        $this->putJson("/api/tutor-profile/availability/{$availabilityId}", [
            'starts_at' => '2030-01-02T21:01:00+01:00',
            'ends_at' => '2030-01-02T22:00:00+01:00',
        ])->assertOk()
            ->assertJsonPath('data.starts_at', '2030-01-02T20:01:00.000000Z')
            ->assertJsonPath('data.ends_at', '2030-01-02T21:00:00.000000Z');

        $this->getJson('/api/tutor-profile/availability')->assertOk()
            ->assertJsonPath('data.0.starts_at', '2030-01-02T20:01:00.000000Z')
            ->assertJsonPath('data.0.ends_at', '2030-01-02T21:00:00.000000Z');
    }

    public function test_update_preserves_utc_instants_on_paris_daylight_saving_transition_date(): void
    {
        $this->travelTo('2026-10-25 10:00:00 UTC');
        $tutor = $this->approvedTutor();
        $created = $this->actingAs($tutor)->postJson('/api/tutor-profile/availability', [
            'starts_at' => '2026-10-25T13:03:00.000Z',
            'ends_at' => '2026-10-25T14:00:00.000Z',
        ])->assertCreated()
            ->assertJsonPath('data.starts_at', '2026-10-25T13:03:00.000000Z')
            ->assertJsonPath('data.ends_at', '2026-10-25T14:00:00.000000Z');

        $availabilityId = $created->json('data.id');
        $this->putJson("/api/tutor-profile/availability/{$availabilityId}", [
            'starts_at' => '2026-10-25T13:04:00.000Z',
            'ends_at' => '2026-10-25T14:00:00.000000Z',
        ])->assertOk()
            ->assertJsonPath('data.starts_at', '2026-10-25T13:04:00.000000Z')
            ->assertJsonPath('data.ends_at', '2026-10-25T14:00:00.000000Z');

        $this->assertDatabaseHas('tutor_availabilities', [
            'id' => $availabilityId,
            'starts_at' => '2026-10-25 13:04:00',
            'ends_at' => '2026-10-25 14:00:00',
        ]);

        $this->getJson('/api/tutor-profile/availability')->assertOk()
            ->assertJsonPath('data.0.starts_at', '2026-10-25T13:04:00.000000Z')
            ->assertJsonPath('data.0.ends_at', '2026-10-25T14:00:00.000000Z');
    }

    public function test_postgresql_connection_uses_utc_for_eloquent_timestamp_bindings(): void
    {
        $this->assertSame('UTC', config('database.connections.pgsql.timezone'));
    }

    public function test_students_and_administrators_cannot_manage_availability(): void
    {
        $student = User::factory()->create();
        $student->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->where('name', Role::ADMIN)->value('id'));
        $owner = $this->approvedTutor();
        $availability = $owner->tutorProfile->availabilities()->create([
            'starts_at' => '2030-01-02 09:00:00',
            'ends_at' => '2030-01-02 10:00:00',
        ]);
        $payload = ['starts_at' => '2030-01-02T09:00:00Z', 'ends_at' => '2030-01-02T10:00:00Z'];

        $this->getJson('/api/tutor-profile/availability')->assertUnauthorized();
        $this->actingAs($student)->getJson('/api/tutor-profile/availability')->assertForbidden();
        $this->actingAs($student)->postJson('/api/tutor-profile/availability', $payload)->assertForbidden();
        $this->putJson("/api/tutor-profile/availability/{$availability->id}", $payload)->assertForbidden();
        $this->deleteJson("/api/tutor-profile/availability/{$availability->id}")->assertForbidden();
        $this->actingAs($admin)->getJson('/api/tutor-profile/availability')->assertForbidden();
        $this->actingAs($admin)->postJson('/api/tutor-profile/availability', $payload)->assertForbidden();
        $this->putJson("/api/tutor-profile/availability/{$availability->id}", $payload)->assertForbidden();
        $this->deleteJson("/api/tutor-profile/availability/{$availability->id}")->assertForbidden();
        $this->assertDatabaseCount('tutor_availabilities', 1);
    }

    public function test_unapproved_tutors_cannot_manage_availability(): void
    {
        $tutor = User::factory()->create();
        $tutor->roles()->attach(Role::query()->where('name', Role::TUTOR)->value('id'));
        $tutor->tutorProfile()->create([]);
        $tutor->tutorApplications()->create(['motivation' => 'Pending application.']);

        $this->actingAs($tutor)->getJson('/api/tutor-profile/availability')->assertForbidden();
        $this->actingAs($tutor)->postJson('/api/tutor-profile/availability', [
            'starts_at' => '2030-01-02T09:00:00Z', 'ends_at' => '2030-01-02T10:00:00Z',
        ])->assertForbidden();
        $this->assertDatabaseCount('tutor_availabilities', 0);
    }

    public function test_tutor_cannot_update_or_delete_another_tutors_interval(): void
    {
        $owner = $this->approvedTutor();
        $other = $this->approvedTutor();
        $availability = $owner->tutorProfile->availabilities()->create([
            'starts_at' => '2030-01-02 09:00:00',
            'ends_at' => '2030-01-02 10:00:00',
        ]);

        $this->actingAs($other)->putJson("/api/tutor-profile/availability/{$availability->id}", [
            'starts_at' => '2030-01-03T09:00:00Z', 'ends_at' => '2030-01-03T10:00:00Z',
        ])->assertForbidden();
        $this->actingAs($other)->deleteJson("/api/tutor-profile/availability/{$availability->id}")->assertForbidden();
        $this->assertDatabaseHas('tutor_availabilities', ['id' => $availability->id, 'starts_at' => '2030-01-02 09:00:00']);
    }

    public function test_past_starts_and_end_times_not_after_start_are_rejected(): void
    {
        $tutor = $this->approvedTutor();

        $this->actingAs($tutor)->postJson('/api/tutor-profile/availability', [
            'starts_at' => '2029-12-31T09:00:00Z', 'ends_at' => '2029-12-31T10:00:00Z',
        ])->assertUnprocessable()->assertJsonValidationErrors('starts_at');
        $this->postJson('/api/tutor-profile/availability', [
            'starts_at' => '2030-01-02T10:00:00Z', 'ends_at' => '2030-01-02T10:00:00Z',
        ])->assertUnprocessable()->assertJsonValidationErrors('ends_at');
        $this->postJson('/api/tutor-profile/availability', [
            'starts_at' => '2030-01-02T11:00:00Z', 'ends_at' => '2030-01-02T10:00:00Z',
        ])->assertUnprocessable()->assertJsonValidationErrors('ends_at');
        $this->assertDatabaseCount('tutor_availabilities', 0);
    }

    public function test_partial_contained_and_containing_intervals_are_rejected_but_adjacent_intervals_are_allowed(): void
    {
        $tutor = $this->approvedTutor();
        $this->actingAs($tutor)->postJson('/api/tutor-profile/availability', [
            'starts_at' => '2030-01-02T10:00:00Z', 'ends_at' => '2030-01-02T11:00:00Z',
        ])->assertCreated();

        foreach ([
            ['2030-01-02T10:30:00Z', '2030-01-02T11:30:00Z'],
            ['2030-01-02T09:00:00Z', '2030-01-02T12:00:00Z'],
            ['2030-01-02T10:15:00Z', '2030-01-02T10:45:00Z'],
        ] as [$startsAt, $endsAt]) {
            $this->postJson('/api/tutor-profile/availability', ['starts_at' => $startsAt, 'ends_at' => $endsAt])
                ->assertUnprocessable()->assertJsonValidationErrors('starts_at');
        }

        $this->postJson('/api/tutor-profile/availability', [
            'starts_at' => '2030-01-02T11:00:00Z', 'ends_at' => '2030-01-02T12:00:00Z',
        ])->assertCreated();
        $this->assertDatabaseCount('tutor_availabilities', 2);
    }

    public function test_update_checks_overlap_but_excludes_the_interval_being_updated(): void
    {
        $tutor = $this->approvedTutor();
        $first = $tutor->tutorProfile->availabilities()->create(['starts_at' => '2030-01-02 09:00:00', 'ends_at' => '2030-01-02 10:00:00']);
        $second = $tutor->tutorProfile->availabilities()->create(['starts_at' => '2030-01-02 13:00:00', 'ends_at' => '2030-01-02 14:00:00']);

        $this->actingAs($tutor)->putJson("/api/tutor-profile/availability/{$first->id}", [
            'starts_at' => '2030-01-02T09:00:00Z', 'ends_at' => '2030-01-02T10:00:00Z',
        ])->assertOk();
        $this->putJson("/api/tutor-profile/availability/{$first->id}", [
            'starts_at' => '2030-01-02T13:30:00Z', 'ends_at' => '2030-01-02T14:30:00Z',
        ])->assertUnprocessable()->assertJsonValidationErrors('starts_at');
        $this->assertDatabaseHas('tutor_availabilities', ['id' => $first->id, 'starts_at' => '2030-01-02 09:00:00']);
        $this->assertDatabaseHas('tutor_availabilities', ['id' => $second->id, 'starts_at' => '2030-01-02 13:00:00']);
    }

    public function test_student_discovery_returns_only_other_eligible_tutors_future_intervals(): void
    {
        $currentTutor = $this->approvedTutor();
        $otherTutor = $this->approvedTutor();
        $inactiveOnlyTutor = $this->approvedTutor();
        $activeSubject = Subject::factory()->create(['is_active' => true]);
        $inactiveSubject = Subject::factory()->create(['is_active' => false]);
        $currentTutor->tutorProfile->offerings()->create(['subject_id' => $activeSubject->id]);
        $otherTutor->tutorProfile->offerings()->create(['subject_id' => $activeSubject->id]);
        $inactiveOnlyTutor->tutorProfile->offerings()->create(['subject_id' => $inactiveSubject->id]);
        $currentTutor->tutorProfile->availabilities()->create(['starts_at' => '2030-01-02 09:00:00', 'ends_at' => '2030-01-02 10:00:00']);
        $future = $otherTutor->tutorProfile->availabilities()->create(['starts_at' => '2030-01-02 11:00:00', 'ends_at' => '2030-01-02 12:00:00']);
        $otherTutor->tutorProfile->availabilities()->create(['starts_at' => '2029-12-31 11:00:00', 'ends_at' => '2029-12-31 12:00:00']);
        $inactiveOnlyTutor->tutorProfile->availabilities()->create(['starts_at' => '2030-01-02 13:00:00', 'ends_at' => '2030-01-02 14:00:00']);

        $this->actingAs($currentTutor)->getJson("/api/tutors/{$otherTutor->tutorProfile->id}/availability")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $future->id);
        $this->getJson("/api/tutors/{$currentTutor->tutorProfile->id}/availability")->assertNotFound();
        $this->getJson("/api/tutors/{$inactiveOnlyTutor->tutorProfile->id}/availability")->assertNotFound();
    }

    public function test_student_discovery_returns_all_three_future_intervals_in_chronological_order(): void
    {
        $student = User::factory()->create();
        $student->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $tutor = $this->approvedTutor();
        $this->addActiveOffering($tutor);

        $intervals = collect([
            ['2030-01-02 09:00:00', '2030-01-02 10:00:00'],
            ['2030-01-02 12:00:00', '2030-01-02 13:00:00'],
            ['2030-01-02 15:00:00', '2030-01-02 16:00:00'],
        ])->map(fn (array $times) => $tutor->tutorProfile->availabilities()->create([
            'starts_at' => $times[0],
            'ends_at' => $times[1],
        ]));

        $tutor->tutorProfile->availabilities()->create([
            'starts_at' => '2029-12-31 09:00:00',
            'ends_at' => '2029-12-31 10:00:00',
        ]);

        $response = $this->actingAs($student)->getJson("/api/tutors/{$tutor->tutorProfile->id}/availability")
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $this->assertSame($intervals->pluck('id')->all(), collect($response->json('data'))->pluck('id')->all());
    }

    public function test_student_discovery_hides_pending_and_accepted_slots_but_releases_rejected_and_cancelled_slots(): void
    {
        $student = User::factory()->create();
        $student->roles()->attach(Role::query()->where('name', Role::STUDENT)->value('id'));
        $tutor = $this->approvedTutor();
        $this->addActiveOffering($tutor);
        $availabilityByStatus = collect([
            Booking::PENDING => ['2030-01-02 09:00:00', '2030-01-02 10:00:00'],
            Booking::ACCEPTED => ['2030-01-02 11:00:00', '2030-01-02 12:00:00'],
            Booking::REJECTED => ['2030-01-02 13:00:00', '2030-01-02 14:00:00'],
            Booking::CANCELLED => ['2030-01-02 15:00:00', '2030-01-02 16:00:00'],
        ])->map(function (array $times, string $status) use ($student, $tutor) {
            $availability = $tutor->tutorProfile->availabilities()->create([
                'starts_at' => $times[0],
                'ends_at' => $times[1],
            ]);

            Booking::factory()->forAvailability($availability)->create([
                'student_id' => $student->getKey(),
                'status' => $status,
            ]);

            return $availability;
        });

        $response = $this->actingAs($student)->getJson("/api/tutors/{$tutor->tutorProfile->id}/availability")
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->assertSame(
            [$availabilityByStatus[Booking::REJECTED]->id, $availabilityByStatus[Booking::CANCELLED]->id],
            collect($response->json('data'))->pluck('id')->all(),
        );
    }
}
