<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Расширяет pin_activities фото-колонками и делает pin_id nullable.
     *
     * Идемпотентна: безопасна при повторном прогоне и при любом порядке
     * с 2026_09_10_000002 (related_user_id/is_incognito).
     */
    public function up(): void
    {
        if (! Schema::hasTable('pin_activities')) {
            return;
        }

        if (! Schema::hasColumn('pin_activities', 'photo_id')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $table->foreignId('photo_id')->nullable()->after('pin_id')->constrained('profile_photos')->cascadeOnDelete();
            });
        }

        if (! Schema::hasColumn('pin_activities', 'photo_comment_id')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $table->foreignId('photo_comment_id')->nullable()->after('comment_id')->constrained('profile_photo_comments')->cascadeOnDelete();
            });
        }
        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `pin_activities` MODIFY `pin_id` BIGINT UNSIGNED NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE "pin_activities" ALTER COLUMN "pin_id" DROP NOT NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('pin_activities')) {
            return;
        }

        if (Schema::hasColumn('pin_activities', 'photo_comment_id')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $table->dropConstrainedForeignId('photo_comment_id');
            });
        }

        if (Schema::hasColumn('pin_activities', 'photo_id')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $table->dropConstrainedForeignId('photo_id');
            });
        }
        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `pin_activities` MODIFY `pin_id` BIGINT UNSIGNED NOT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE "pin_activities" ALTER COLUMN "pin_id" SET NOT NULL');
        }
    }
};
