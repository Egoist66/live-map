<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Убрать региональные цены тарифов (одна цена для всех стран).
 *
 * Удаляет оверрайды `{plan}.regional_monthly` из витрины: после отказа
 * от деления «весь мир / Россия и Беларусь» их никто не читает,
 * а в админке они висели бы вечным мусором.
 */
return new class extends Migration
{
    /**
     * Удалить устаревшие региональные строки цен.
     */
    public function up(): void
    {
        if (! Schema::hasTable('payment_items')) {
            return;
        }

        DB::table('payment_items')
            ->where('kind', 'plan_price')
            ->where('key', 'like', '%.regional_monthly')
            ->delete();
    }

    /**
     * Откат не восстанавливает удалённые строки (цены задаются в админке).
     */
    public function down(): void
    {
    }
};
