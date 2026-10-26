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
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->restrictOnDelete();
            $table->uuid('client_message_id');
            $table->text('body')->nullable();
            $table->timestampTz('read_at')->nullable();
            $table->timestamps();

            $table->unique(['conversation_id', 'sender_id', 'client_message_id'], 'messages_sender_idempotency_unique');
            $table->index(['conversation_id', 'created_at', 'id'], 'messages_conversation_history_index');
            $table->index(['conversation_id', 'sender_id', 'read_at'], 'messages_conversation_read_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
