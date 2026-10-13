<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'telegram_notify_enabled')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->boolean('telegram_notify_enabled')->default(true)->after('telegram_blocked_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('telegram_notify_enabled');
        });
    }
};
