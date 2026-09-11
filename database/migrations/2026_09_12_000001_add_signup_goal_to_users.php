<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Цель захода в приложение: ULove-цели ведут в свайпы, карта — на карту.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('signup_goal', 20)->nullable()->after('dating_goal');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('signup_goal');
        });
    }
};
