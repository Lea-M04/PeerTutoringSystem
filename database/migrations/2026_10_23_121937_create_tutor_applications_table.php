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
        Schema::create('tutor_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->text('motivation');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });

        if (! in_array(DB::connection()->getDriverName(), ['pgsql', 'sqlite'], true)) {
            throw new RuntimeException('Tutor application uniqueness requires PostgreSQL or SQLite partial indexes.');
        }

        DB::statement("CREATE UNIQUE INDEX tutor_applications_one_pending_per_user ON tutor_applications (user_id) WHERE status = 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS tutor_applications_one_pending_per_user');

        Schema::dropIfExists('tutor_applications');
    }
};
