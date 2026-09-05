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
                $table->string('screen_lock_code', 32)->nullable();
            }
            if (!Schema::hasColumn('users', 'screen_lock_timeout')) {
                $table->unsignedSmallInteger('screen_lock_timeout')->default(5);
            }
            if (!Schema::hasColumn('users', 'screen_lock_kind')) {
                $table->string('screen_lock_kind', 12)->nullable()->default('pin4');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'screen_lock_kind')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('screen_lock_kind');
            });
        }
    }
};
