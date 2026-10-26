<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('ALTER TABLE bookings ADD COLUMN subject_id INTEGER NULL REFERENCES subjects(id) ON DELETE RESTRICT');
        } else {
            DB::statement('ALTER TABLE bookings ADD COLUMN subject_id BIGINT NULL REFERENCES subjects(id) ON DELETE RESTRICT');
        }

        DB::statement('CREATE INDEX bookings_subject_id_index ON bookings (subject_id)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE bookings DROP COLUMN subject_id');
    }
};
