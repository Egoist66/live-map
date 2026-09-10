<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscriber_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('target_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('notify_pin')->default(true);
            $table->boolean('notify_photo')->default(true);
            $table->boolean('notify_level')->default(true);
            $table->timestamps();
            $table->unique(['subscriber_id', 'target_id']);
            $table->index('target_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_subscriptions');
    }
};
