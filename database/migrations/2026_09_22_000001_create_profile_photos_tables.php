<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profile_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('path', 255);
            $table->string('caption', 500)->nullable();
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('comments_count')->default(0);
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('profile_photo_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('photo_id')->constrained('profile_photos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Дублирует 2026_09_10_000003: та миграция датирована раньше
            // создания таблицы, поэтому на свежих базах шла до неё и падала.
            $table->boolean('is_incognito')->default(false);
            $table->timestamps();
            $table->unique(['photo_id', 'user_id']);
            $table->index('user_id');
        });

        Schema::create('profile_photo_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('photo_id')->constrained('profile_photos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('content', 1000);
            $table->timestamps();
            $table->index(['photo_id', 'created_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('photo_comments_privacy', 16)->default('everyone')->after('allow_random_messages');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('photo_comments_privacy');
        });
        Schema::dropIfExists('profile_photo_comments');
        Schema::dropIfExists('profile_photo_likes');
        Schema::dropIfExists('profile_photos');
    }
};
