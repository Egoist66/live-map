<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swipe_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('liker_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('liked_id')->constrained('users')->cascadeOnDelete();
            $table->enum('action', ['like', 'pass'])->default('like');
            $table->timestamps();

            $table->unique(['liker_id', 'liked_id']);
            $table->index(['liked_id', 'action']);
        });

        Schema::create('dating_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_a_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('user_b_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_a_id', 'user_b_id']);
            $table->index('user_b_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dating_matches');
        Schema::dropIfExists('swipe_actions');
    }
};
