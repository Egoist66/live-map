<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Медиа треда Pipe: до 3 оптимизированных картинок к посту
 * (ImageOptimizer::storeOptimized + thumb), путь на media-диске.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pipe_thread_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('thread_id')->constrained('pipe_threads')->cascadeOnDelete();
            $table->string('path');
            $table->string('thumb_path')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['thread_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pipe_thread_media');
    }
};
