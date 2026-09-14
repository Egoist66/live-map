<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('description', 500)->nullable();
            $table->string('interest', 32)->default('neighbors');
            $table->json('geometry');
            $table->decimal('center_lat', 10, 7);
            $table->decimal('center_lng', 10, 7);
            $table->foreignId('conversation_id')->nullable()->constrained('conversations')->nullOnDelete();
            $table->timestamps();
            $table->index(['center_lat', 'center_lng']);
        });

        Schema::create('district_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('district_id')->constrained('districts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['pending', 'approved'])->default('pending');
            $table->timestamps();
            $table->unique(['district_id', 'user_id']);
            $table->index('status');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->foreignId('district_id')->nullable()->after('pin_id')->constrained('districts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('district_id');
        });
        Schema::dropIfExists('district_members');
        Schema::dropIfExists('districts');
    }
};
