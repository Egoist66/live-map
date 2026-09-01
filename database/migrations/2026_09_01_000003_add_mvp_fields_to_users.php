<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('email');
            $table->decimal('home_lat', 10, 7)->nullable()->after('longitude');
            $table->decimal('home_lng', 10, 7)->nullable()->after('home_lat');
            $table->smallInteger('home_radius_km')->unsigned()->default(2)->after('home_lng');
            $table->integer('reputation_score')->unsigned()->default(0)->after('home_radius_km');
            $table->enum('level', ['novice', 'local', 'guide'])->default('novice')->after('reputation_score');
            $table->boolean('is_anonymous_default')->default(false)->after('level');
            $table->json('settings')->nullable()->after('is_anonymous_default');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['avatar_path', 'home_lat', 'home_lng', 'home_radius_km', 'reputation_score', 'level', 'is_anonymous_default', 'settings']);
        });
    }
};
