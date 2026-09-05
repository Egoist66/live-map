<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pin_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pin_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('kind', 16);
            $table->string('reaction_type', 16)->nullable();
            $table->foreignId('comment_id')->nullable()->constrained('pin_comments')->nullOnDelete();
            $table->string('excerpt', 160)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['owner_id', 'read_at', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pin_activities');
    }
};
