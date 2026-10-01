<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * sort_order был unsigned: makeMain/mirror делали min - 1
     * и при min = 0 MySQL ронял запрос (Out of range value, 500
     * на POST /api/photos/{photo}/main). Делаем колонку знаковой,
     * код при этом больше не уходит в минус (перенумерация в 0/10/20…).
     */
    public function up(): void
    {
        if (! Schema::hasColumn('profile_photos', 'sort_order')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `profile_photos` MODIFY `sort_order` INT NOT NULL DEFAULT 0');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE profile_photos ALTER COLUMN sort_order TYPE INTEGER USING sort_order::integer');
            DB::statement('ALTER TABLE profile_photos ALTER COLUMN sort_order SET DEFAULT 0');
            DB::statement('ALTER TABLE profile_photos ALTER COLUMN sort_order SET NOT NULL');
        }
        // SQLite игнорирует unsigned и не требует MODIFY.
    }

    public function down(): void
    {
        if (! Schema::hasColumn('profile_photos', 'sort_order')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `profile_photos` MODIFY `sort_order` INT UNSIGNED NOT NULL DEFAULT 0');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE profile_photos ALTER COLUMN sort_order TYPE INTEGER USING sort_order::integer');
        }
    }
};
