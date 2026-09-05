<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE pins MODIFY category VARCHAR(32) NOT NULL DEFAULT 'announcement'");
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("UPDATE pins SET category='announcement' WHERE category NOT IN ('question','announcement','warning','event','offer','help','sport','food','music','pets','sale','job','study','travel','tech','health','art','humor','rest')");
            DB::statement("ALTER TABLE pins MODIFY category ENUM('question','announcement','warning','event','offer','help','sport','food','music','pets','sale','job','study','travel','tech','health','art','humor','rest') DEFAULT 'announcement'");
        }
    }
};
