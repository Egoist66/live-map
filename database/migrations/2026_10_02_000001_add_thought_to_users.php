<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'thought')) return;
        if (Schema::hasColumn('users', 'bio')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('thought', 140)->nullable()->after('bio');
            });
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->string('thought', 140)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'thought')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('thought');
            });
        }
    }
};
