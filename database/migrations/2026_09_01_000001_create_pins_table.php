<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->text('body')->nullable();
            $table->enum('category', ['question','announcement','warning','event','offer','help'])->default('announcement');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->integer('radius_meters')->default(1000);
            $table->timestamp('expires_at')->index();
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_sponsored')->default(false);
            $table->boolean('is_boosted')->default(false);
            $table->timestamp('boosted_until')->nullable();
            $table->unsignedInteger('views_count')->default(0);
            $table->unsignedInteger('likes_count')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['latitude','longitude']);
            $table->index('category');
        });

        Schema::create('pin_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pin_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('ip', 45)->nullable();
            $table->timestamps();
        });

        Schema::create('pin_boosts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pin_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['top','glow','notify','extend'])->default('top');
            $table->integer('duration_hours')->default(1);
            $table->decimal('price', 8, 2);
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pin_boosts');
        Schema::dropIfExists('pin_views');
        Schema::dropIfExists('pins');
    }
};
