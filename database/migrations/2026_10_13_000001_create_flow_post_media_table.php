<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flow_post_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('flow_posts')->cascadeOnDelete();
            $table->string('kind', 16)->default('photo');
            $table->string('path');
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedInteger('duration_sec')->nullable();
            $table->timestamps();
            $table->index(['post_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flow_post_media');
    }
};
