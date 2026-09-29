<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('telegram_notify_messages')->default(true)->after('telegram_linked_at');
            $table->boolean('telegram_notify_likes')->default(true)->after('telegram_notify_messages');
            $table->boolean('telegram_notify_matches')->default(true)->after('telegram_notify_likes');
            $table->timestamp('telegram_blocked_at')->nullable()->after('telegram_notify_matches');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['telegram_notify_messages', 'telegram_notify_likes', 'telegram_notify_matches', 'telegram_blocked_at']);
        });
    }
};
