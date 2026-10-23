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
        Schema::create('subject_tutor_application', function (Blueprint $table) {
            $table->foreignId('subject_id')->constrained()->restrictOnDelete();
            $table->foreignId('tutor_application_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->primary(['subject_id', 'tutor_application_id']);
            $table->index('tutor_application_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subject_tutor_application');
    }
};
