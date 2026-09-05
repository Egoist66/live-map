<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'screen_lock_code')) {
                $table->string('screen_lock_code', 32)->nullable()->after('is_invisible');
            }
            if (!Schema::hasColumn('users', 'screen_lock_timeout')) {
                $table->unsignedSmallInteger('screen_lock_timeout')->default(5)->after('screen_lock_code');
            }
        });
    }

    public function down(): void
    {
        $drop = [];
        if (Schema::hasColumn('users', 'screen_lock_code')) $drop[] = 'screen_lock_code';
        if (Schema::hasColumn('users', 'screen_lock_timeout')) $drop[] = 'screen_lock_timeout';
        if ($drop) {
            Schema::table('users', function (Blueprint $table) use ($drop) {
                $table->dropColumn($drop);
            });
        }
    }
};
