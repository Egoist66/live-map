<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Таблицы мини-приложения Pipe (pipe.ulove.by): треды, ответы,
 * лайки и подписки внутри Pipe. Плюс расширение типов целей
 * жалоб reports для модерации Pipe-контента.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pipe_threads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('body', 700);
            $table->boolean('is_anonymous')->default(false);
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('replies_count')->default(0);
            $table->string('moderation_category')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'id']);
            $table->index(['created_at']);
        });

        Schema::create('pipe_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('thread_id')->constrained('pipe_threads')->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('pipe_replies')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('body', 700);
            $table->boolean('is_anonymous')->default(false);
            $table->unsignedInteger('likes_count')->default(0);
            $table->string('moderation_category')->nullable();
            $table->timestamps();
            $table->index(['thread_id', 'id']);
            $table->index(['parent_id']);
        });

        Schema::create('pipe_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('thread_id')->nullable()->constrained('pipe_threads')->cascadeOnDelete();
            $table->foreignId('reply_id')->nullable()->constrained('pipe_replies')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['thread_id', 'user_id']);
            $table->unique(['reply_id', 'user_id']);
            $table->index(['user_id']);
        });

        Schema::create('pipe_follows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('follower_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('following_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['follower_id', 'following_id']);
            $table->index(['following_id']);
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->enum('target_type', ['pin', 'comment', 'user', 'pipe_thread', 'pipe_reply'])->change();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pipe_follows');
        Schema::dropIfExists('pipe_likes');
        Schema::dropIfExists('pipe_replies');
        Schema::dropIfExists('pipe_threads');

        Schema::table('reports', function (Blueprint $table) {
            $table->enum('target_type', ['pin', 'comment', 'user'])->change();
        });
    }
};
