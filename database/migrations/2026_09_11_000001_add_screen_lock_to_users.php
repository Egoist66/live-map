<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('screen_lock_code', 8)->nullable()->after('is_invisible');
            $table->unsignedSmallInteger('screen_lock_timeout')->default(5)->after('screen_lock_code');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['screen_lock_code', 'screen_lock_timeout']);
        });
    }
};
