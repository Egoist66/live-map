<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Добавляет роль `organization` в users.role.
 *
 * Организации живут в той же таблице users (account_type=business,
 * кабинет компании). Раз зашли в кабинет — значит оплатили тариф
 * business, поэтому бэкфилл: всем account_type=business выдаём
 * role=organization + plan=business (+30 дней, если срок пуст/прошёл).
 */
return new class extends Migration
{
    private const ROLES_WITH_ORG = "'user','moderator','admin','organization'";

    private const ROLES_BASE = "'user','moderator','admin'";

    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement(
                'ALTER TABLE `users` MODIFY `role` ENUM(' . self::ROLES_WITH_ORG . ") NOT NULL DEFAULT 'user'"
            );
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(32)");
        }

        try {
            $now = now();
            $fallbackExpiry = $now->copy()->addDays(30);

            DB::table('users')
                ->where('account_type', 'business')
                ->where('role', '!=', 'organization')
                ->update(['role' => 'organization']);

            $businessUsers = DB::table('users')
                ->where('account_type', 'business')
                ->select('id', 'plan', 'plan_expires_at')
                ->get();

            foreach ($businessUsers as $row) {
                $needsPlan = ($row->plan ?? 'free') !== 'business';
                $needsExpiry = true;

                if (! $needsPlan && $row->plan_expires_at !== null) {
                    try {
                        $needsExpiry = \Carbon\Carbon::parse($row->plan_expires_at)->isPast();
                    } catch (\Throwable) {
                        $needsExpiry = true;
                    }
                }

                if (! $needsPlan && ! $needsExpiry) {
                    continue;
                }

                DB::table('users')
                    ->where('id', $row->id)
                    ->update([
                        'plan' => 'business',
                        'plan_expires_at' => $fallbackExpiry,
                    ]);
            }
        } catch (\Throwable $e) {
            \Log::warning('organization role backfill skipped', ['error' => $e->getMessage()]);
        }
    }

    public function down(): void
    {
        try {
            DB::table('users')
                ->where('role', 'organization')
                ->update(['role' => 'user']);
        } catch (\Throwable) {
        }

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement(
                'ALTER TABLE `users` MODIFY `role` ENUM(' . self::ROLES_BASE . ") NOT NULL DEFAULT 'user'"
            );
        }
    }
};
