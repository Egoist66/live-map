<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'bio')) return;
        if (Schema::hasColumn('users', 'home_radius_km')) {
            Schema::table('users', function (Blueprint $table) {
                $table->text('bio')->nullable()->after('home_radius_km');
            });
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->text('bio')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'bio')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('bio');
            });
        }
    }
};
