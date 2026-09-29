<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_devices', function (Blueprint $table) {
            // Наследство считается доверенным, новые неизвестные — нет.
            $table->boolean('trusted')->default(true)->after('client');
            $table->boolean('blocked')->default(false)->after('trusted');
            $table->string('session_id', 255)->nullable()->after('blocked');
        });
    }

    public function down(): void
    {
        Schema::table('user_devices', function (Blueprint $table) {
            $table->dropColumn(['trusted', 'blocked', 'session_id']);
        });
    }
};
