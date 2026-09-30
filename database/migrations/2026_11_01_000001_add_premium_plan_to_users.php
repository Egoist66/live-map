<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Тариф Premium для стаффа + разделение с Business организаторов.
 *
 * До: админы получали plan=business. После: стафф (is_admin/role admin/moderator)
 * живёт на plan=premium (тот же топ-уровень лимитов), а business остаётся
 * только у организаторов (role=organization / account_type=business).
 * effectivePlan() у стаффа всегда возвращает premium, даже если в базе free.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE `users` MODIFY COLUMN `plan` ENUM('free','pro','premium','business') NOT NULL DEFAULT 'free'");
        }

        // Стафф с business -> premium. Организаторов не трогаем.
        DB::table('users')
            ->where('plan', 'business')
            ->where(function ($q) {
                $q->where('is_admin', true)
                    ->orWhereIn('role', ['admin', 'moderator']);
            })
            ->update(['plan' => 'premium']);
    }

    public function down(): void
    {
        // Вернуть стафф с premium обратно на business (организаторы не затронуты,
        // т.к. у них role=organization — их premium не бывает).
        DB::table('users')
            ->where('plan', 'premium')
            ->where(function ($q) {
                $q->where('is_admin', true)
                    ->orWhereIn('role', ['admin', 'moderator']);
            })
            ->update(['plan' => 'business']);

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE `users` MODIFY COLUMN `plan` ENUM('free','pro','business') NOT NULL DEFAULT 'free'");
        }
    }
};
