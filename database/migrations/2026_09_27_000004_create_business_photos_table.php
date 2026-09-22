<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('path', 255);
            $table->string('caption', 140)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['business_id', 'sort_order']);
        });

        Schema::table('businesses', function (Blueprint $table) {
            $table->text('services')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_photos');

        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn('services');
        });
    }
};
