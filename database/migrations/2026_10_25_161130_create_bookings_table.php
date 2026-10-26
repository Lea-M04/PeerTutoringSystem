<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['pgsql', 'sqlite'], true)) {
            throw new RuntimeException('Active booking uniqueness requires PostgreSQL or SQLite partial indexes.');
        }

        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('tutor_profile_id')->constrained('tutor_profiles')->restrictOnDelete();
            $table->foreignId('tutor_availability_id')->constrained('tutor_availabilities')->restrictOnDelete();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->enum('status', ['pending', 'accepted', 'rejected', 'cancelled', 'completed'])->default('pending');
            $table->timestamps();

            $table->index(['student_id', 'status', 'starts_at'], 'bookings_student_status_start_index');
            $table->index(['tutor_profile_id', 'status', 'starts_at'], 'bookings_tutor_status_start_index');
        });

        DB::statement("CREATE UNIQUE INDEX bookings_one_reserving_per_availability ON bookings (tutor_availability_id) WHERE status IN ('pending', 'accepted')");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS bookings_one_reserving_per_availability');

        Schema::dropIfExists('bookings');
    }
};
