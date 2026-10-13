<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bot_broadcasts', function (Blueprint $table) {
            $table->id();
            $table->string('type', 10);
            $table->string('title', 200);
            $table->text('body')->nullable();
            $table->string('photo_url', 512)->nullable();
            $table->string('poll_question', 300)->nullable();
            $table->json('poll_options')->nullable();
            $table->boolean('poll_multiple')->default(false);
            $table->string('status', 10)->default('draft');
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('votes_count')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'published_at']);
        });

        Schema::create('bot_broadcast_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broadcast_id')->constrained('bot_broadcasts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->bigInteger('chat_id');
            $table->bigInteger('message_id')->nullable();
            $table->string('telegram_poll_id', 64)->nullable();
            $table->json('voted_option_ids')->nullable();
            $table->timestamps();

            $table->unique(['broadcast_id', 'user_id']);
            $table->unique(['telegram_poll_id']);
            $table->index(['broadcast_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bot_broadcast_messages');
        Schema::dropIfExists('bot_broadcasts');
    }
};
