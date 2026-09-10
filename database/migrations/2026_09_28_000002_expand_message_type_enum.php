<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE `messages` MODIFY `type` ENUM('text','system','image','file') NOT NULL DEFAULT 'text'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("UPDATE `messages` SET `type` = 'text' WHERE `type` NOT IN ('text','system')");
            DB::statement("ALTER TABLE `messages` MODIFY `type` ENUM('text','system') NOT NULL DEFAULT 'text'");
        }
    }
};
