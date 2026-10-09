<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dating_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('target_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->string('body', 280)->nullable();
            $table->timestamps();

            $table->unique(['author_id', 'target_id']);
            $table->index(['target_id', 'created_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->boolean('dating_hide_rating')->default(false)->after('dating_match_only');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dating_reviews');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('dating_hide_rating');
        });
    }
};
