<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pins', function (Blueprint $table) {
            $table->timestamp('publish_at')->nullable()->after('expires_at')->index();
        });

        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE `pins` MODIFY `status` ENUM('active','expired','archived','deleted','scheduled') NOT NULL DEFAULT 'active'");
        }
    }

    public function down(): void
    {
        Schema::table('pins', function (Blueprint $table) {
            $table->dropColumn('publish_at');
        });

        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement("UPDATE `pins` SET `status` = 'active' WHERE `status` = 'scheduled'");
            DB::statement("ALTER TABLE `pins` MODIFY `status` ENUM('active','expired','archived','deleted') NOT NULL DEFAULT 'active'");
        }
    }
};
