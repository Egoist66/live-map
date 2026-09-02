<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('message_privacy', ['everyone','friends','none'])->default('everyone')->after('is_anonymous_default');
            $table->boolean('allow_random_messages')->default(true)->after('message_privacy');
        });

        Schema::create('friendships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('addressee_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['pending','accepted','declined','blocked'])->default('pending');
            $table->timestamps();
            $table->unique(['requester_id','addressee_id']);
            $table->index('status');
        });

        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->string('type')->default('direct');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();
        });

        Schema::create('conversation_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('last_read_at')->nullable();
            $table->timestamp('joined_at')->nullable();
            $table->unique(['conversation_id','user_id']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->enum('type', ['text','system'])->default('text');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['conversation_id','created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversation_participants');
        Schema::dropIfExists('conversations');
        Schema::dropIfExists('friendships');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['message_privacy','allow_random_messages']);
        });
    }
};
