<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pin_activities', function (Blueprint $table) {
            $table->foreignId('photo_id')->nullable()->after('pin_id')->constrained('profile_photos')->cascadeOnDelete();
            $table->foreignId('photo_comment_id')->nullable()->after('comment_id')->constrained('profile_photo_comments')->cascadeOnDelete();
        });
        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `pin_activities` MODIFY `pin_id` BIGINT UNSIGNED NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE "pin_activities" ALTER COLUMN "pin_id" DROP NOT NULL');
        }
    }

    public function down(): void
    {
        Schema::table('pin_activities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('photo_comment_id');
            $table->dropConstrainedForeignId('photo_id');
        });
        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `pin_activities` MODIFY `pin_id` BIGINT UNSIGNED NOT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE "pin_activities" ALTER COLUMN "pin_id" SET NOT NULL');
        }
    }
};
