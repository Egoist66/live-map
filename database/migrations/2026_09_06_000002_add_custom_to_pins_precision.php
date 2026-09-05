<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE pins MODIFY location_precision ENUM('blur_200','exact','district','custom') DEFAULT 'blur_200'");
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("UPDATE pins SET location_precision='blur_200' WHERE location_precision='custom'");
            DB::statement("ALTER TABLE pins MODIFY location_precision ENUM('blur_200','exact','district') DEFAULT 'blur_200'");
        }
    }
};
