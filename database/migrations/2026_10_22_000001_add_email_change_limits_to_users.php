<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Лимиты смены почты (email) аккаунта.
 *
 * - email_changes_used: сколько смен почты сделано. Для Free это
 *   счётчик за всю жизнь (одна бесплатная смена), для Premium/Business
 *   — счётчик внутри текущего месячного окна (три смены в месяц).
 * - email_changed_at: когда сменили почту в последний раз.
 * - email_changes_window_started_at: старт текущего месячного окна
 *   лимита (только для платных тарифов, у Free всегда null).
 *
 * Правила у User::canChangeEmail / User::consumeEmailChange.
 */
return new class extends Migration
{
    /**
     * @return void
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('email_changes_used')->default(0)->after('email');
            $table->timestamp('email_changed_at')->nullable()->after('email_changes_used');
            $table->timestamp('email_changes_window_started_at')->nullable()->after('email_changed_at');
        });
    }

    /**
     * @return void
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['email_changes_used', 'email_changed_at', 'email_changes_window_started_at']);
        });
    }
};
