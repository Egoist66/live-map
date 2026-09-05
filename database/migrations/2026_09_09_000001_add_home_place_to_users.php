<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('home_city', 120)->nullable()->after('home_lng');
            $table->string('home_address', 255)->nullable()->after('home_city');
            $table->enum('home_visibility', ['everyone', 'friends', 'none'])->default('everyone')->after('home_address');
            $table->boolean('home_show_exact')->default(false)->after('home_visibility');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['home_city', 'home_address', 'home_visibility', 'home_show_exact']);
        });
    }
};
