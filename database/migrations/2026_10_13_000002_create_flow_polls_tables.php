<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flow_polls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->unique()->constrained('flow_posts')->cascadeOnDelete();
            $table->timestamp('closes_at')->nullable();
            $table->boolean('closed')->default(false);
            $table->unsignedInteger('total_votes')->default(0);
            $table->timestamps();
        });

        Schema::create('flow_poll_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poll_id')->constrained('flow_polls')->cascadeOnDelete();
            $table->string('text', 120);
            $table->unsignedInteger('votes_count')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['poll_id', 'sort_order']);
        });

        Schema::create('flow_poll_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poll_id')->constrained('flow_polls')->cascadeOnDelete();
            $table->foreignId('option_id')->constrained('flow_poll_options')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['poll_id', 'user_id']);
            $table->index('option_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flow_poll_votes');
        Schema::dropIfExists('flow_poll_options');
        Schema::dropIfExists('flow_polls');
    }
};
