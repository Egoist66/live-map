<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('district_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('district_id')->constrained('districts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 150)->nullable();
            $table->text('body');
            $table->string('image_path', 512)->nullable();
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('comments_count')->default(0);
            $table->timestamps();
            $table->index(['district_id', 'created_at']);
        });

        Schema::create('district_post_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('district_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('district_post_comments')->cascadeOnDelete();
            $table->text('content');
            $table->timestamps();
            $table->index(['post_id', 'created_at']);
        });

        Schema::create('district_post_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('district_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['post_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('district_post_likes');
        Schema::dropIfExists('district_post_comments');
        Schema::dropIfExists('district_posts');
    }
};
