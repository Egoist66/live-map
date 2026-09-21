<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Видеозвонки 1-1 (мэтч-звонки и рулетка) + персистентный сигналинг.
     *
     * Сигналы (offer/answer/ice) храним в БД, а не только broadcast:
     * polling-клиент без сокета забирает их через /api/realtime/sync.
     */
    public function up(): void
    {
        Schema::create('video_calls', function (Blueprint $table) {
            $table->id();
            $table->string('mode', 16)->default('match');
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

    public function down(): void
    {
        Schema::dropIfExists('video_signals');
        Schema::dropIfExists('video_calls');
    }
};
