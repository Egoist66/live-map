<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profile_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('viewed_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('viewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['viewed_id', 'created_at']);
            $table->index(['viewer_id', 'viewed_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_views');
    }
};
