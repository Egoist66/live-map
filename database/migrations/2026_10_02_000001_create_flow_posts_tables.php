<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flow_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->string('image_path')->nullable();
            $table->boolean('is_anonymous')->default(false);
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('comments_count')->default(0);
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
            $table->index('created_at');
        });

        Schema::create('flow_post_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('flow_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('flow_post_comments')->cascadeOnDelete();
            $table->text('content');
            $table->boolean('is_anonymous')->default(false);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['post_id', 'created_at']);
            $table->index('parent_id');
        });

        Schema::create('flow_post_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('flow_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->unique(['post_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flow_post_likes');
        Schema::dropIfExists('flow_post_comments');
        Schema::dropIfExists('flow_posts');
    }
};
