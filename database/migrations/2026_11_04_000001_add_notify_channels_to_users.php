<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('email_notify_messages')->default(true)->after('telegram_blocked_at');
            $table->boolean('email_notify_likes')->default(true)->after('email_notify_messages');
            $table->boolean('email_notify_matches')->default(true)->after('email_notify_likes');
            $table->boolean('telegram_dm_messages')->default(false)->after('email_notify_matches');
            $table->boolean('telegram_dm_likes')->default(false)->after('telegram_dm_messages');
            $table->boolean('telegram_dm_matches')->default(false)->after('telegram_dm_likes');
            $table->boolean('telegram_dm_comments')->default(false)->after('telegram_dm_matches');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'email_notify_messages',
                'email_notify_likes',
                'email_notify_matches',
                'telegram_dm_messages',
                'telegram_dm_likes',
                'telegram_dm_matches',
                'telegram_dm_comments',
            ]);
        });
    }
};
