<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_reward_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('action', 32);
            $table->string('target_type', 32)->default('');
            $table->unsignedBigInteger('target_id')->default(0);
            $table->string('meta', 64)->default('');
            $table->string('week_key', 8);
            $table->unsignedInteger('points')->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'action', 'target_type', 'target_id', 'meta', 'week_key'], 'reward_claim_unique');
            $table->index(['user_id', 'action', 'week_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_reward_claims');
    }
};
