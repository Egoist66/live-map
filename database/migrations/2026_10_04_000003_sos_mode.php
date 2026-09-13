<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sos_calls')) {
            Schema::create('sos_calls', function (Blueprint $table) {
                $table->id();
                $table->foreignId('pin_id')->unique()->constrained('pins')->cascadeOnDelete();
                $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('responder_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status', 16)->default('pending');
                $table->foreignId('conversation_id')->nullable()->constrained('conversations')->nullOnDelete();
                $table->timestamps();
                $table->index(['creator_id', 'status']);
                $table->index(['responder_id', 'status']);
                $table->index(['status']);
            });
        }

        if (! Schema::hasTable('sos_call_declines')) {
            Schema::create('sos_call_declines', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sos_call_id')->constrained('sos_calls')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamps();
                $table->unique(['sos_call_id', 'user_id']);
            });
        }

        Schema::table('conversations', function (Blueprint $table) {
            if (! Schema::hasColumn('conversations', 'pin_id')) {
                $table->foreignId('pin_id')->nullable()->after('created_by')->constrained('pins')->nullOnDelete();
                $table->index(['pin_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            try {
                $table->dropConstrainedForeignId('pin_id');
            } catch (\Throwable) {
            }
            try {
                $table->dropIndex(['pin_id']);
            } catch (\Throwable) {
            }
        });
        Schema::dropIfExists('sos_call_declines');
        Schema::dropIfExists('sos_calls');
    }
};
