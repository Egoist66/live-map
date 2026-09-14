<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE `district_members` MODIFY `status` ENUM('pending','approved','invited') NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE `district_members` MODIFY `status` ENUM('pending','approved') NOT NULL DEFAULT 'pending'");
    }
};
