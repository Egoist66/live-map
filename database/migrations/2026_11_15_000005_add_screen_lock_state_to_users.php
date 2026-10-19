<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Серверное состояние скринлокера: только факт активности и маркер сброса.
     *
     * Сам код блокировки по-прежнему живёт на устройстве (IndexedDB).
     * Бэкенду нужен лишь boolean `is_sl_active`, чтобы показать в
     * Telegram-боте пункт «Сброс скринлокера», и `screen_lock_reset_at` —
     * метка, по которой устройство понимает, что локальный код пора стереть.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'is_sl_active')) {
                $table->boolean('is_sl_active')->default(false)->after('telegram_notify_enabled');
            }

            if (! Schema::hasColumn('users', 'screen_lock_reset_at')) {
                $table->timestamp('screen_lock_reset_at')->nullable()->after('is_sl_active');
            }
        });
    }

    /**
     * Откатить серверное состояние скринлокера.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'screen_lock_reset_at')) {
                $table->dropColumn('screen_lock_reset_at');
            }

            if (Schema::hasColumn('users', 'is_sl_active')) {
                $table->dropColumn('is_sl_active');
            }
        });
    }
};
