<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Звонки временно отключены: таблицы video_calls/video_signals удаляем,
 * чтобы не занимали место. Код, который их читает (тик sync), проверяет
 * наличие таблиц и молча отдаёт пусто — чат не пострадает.
 *
 * Откат пересоздаёт таблицы в актуальной схеме (с audio_only).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('video_signals');
        Schema::dropIfExists('video_calls');
    }

    public function down(): void
    {
        Schema::create('video_calls', function (Blueprint $table) {
            $table->id();
            $table->string('mode', 16)->default('match');
            $table->boolean('audio_only')->default(false);
            $table->foreignId('caller_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('callee_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('match_id')->nullable();
            $table->string('status', 16)->default('ringing');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['caller_id', 'status']);
            $table->index(['callee_id', 'status']);
            $table->index('created_at');
        });

        Schema::create('video_signals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('call_id')->constrained('video_calls')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->string('kind', 16);
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['call_id', 'id']);
        });
    }
};
