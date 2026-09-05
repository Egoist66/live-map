<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('default_blur_meters', 200)
            ->where(fn($q) => $q->where('default_location_precision', 'blur_200')->orWhereNull('default_location_precision'))
            ->update(['default_blur_meters' => 300]);
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE users MODIFY default_blur_meters SMALLINT UNSIGNED DEFAULT 300');
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE users MODIFY default_blur_meters SMALLINT UNSIGNED DEFAULT 200');
        }
    }
};
