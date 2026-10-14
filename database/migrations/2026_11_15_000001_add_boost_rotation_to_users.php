<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (! Schema::hasColumn('users', 'boost_started_at')) {
                    $table->timestamp('boost_started_at')->nullable()->after('boost_until');
                }

                if (! Schema::hasColumn('users', 'boost_impressions')) {
                    $table->unsignedInteger('boost_impressions')->default(0)->after('boost_started_at');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (Schema::hasColumn('users', 'boost_impressions')) {
                    $table->dropColumn('boost_impressions');
                }

                if (Schema::hasColumn('users', 'boost_started_at')) {
                    $table->dropColumn('boost_started_at');
                }
            });
        }
    }
};
