<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('in_app_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('event_key', 120)->unique();
            $table->string('type', 64);
            $table->string('title', 120);
            $table->string('message', 500);
            $table->foreignId('booking_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('tutor_application_id')->nullable()->constrained()->nullOnDelete();
            $table->timestampTz('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at'], 'in_app_notifications_user_read_index');
            $table->index(['user_id', 'created_at', 'id'], 'in_app_notifications_user_created_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('in_app_notifications');
    }
};
