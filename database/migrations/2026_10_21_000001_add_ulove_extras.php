<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('swipe_actions') && ! Schema::hasColumn('swipe_actions', 'is_superlike')) {
            Schema::table('swipe_actions', function (Blueprint $table) {
                $table->boolean('is_superlike')->default(false)->after('is_incognito');
            });
        }

        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (! Schema::hasColumn('users', 'superlikes_day')) {
                    $table->date('superlikes_day')->nullable()->after('random_chats_month');
                }

                if (! Schema::hasColumn('users', 'superlikes_used')) {
                    $table->unsignedSmallInteger('superlikes_used')->default(0)->after('superlikes_day');
                }

                if (! Schema::hasColumn('users', 'superlikes_balance')) {
                    $table->unsignedSmallInteger('superlikes_balance')->default(0)->after('superlikes_used');
                }

                if (! Schema::hasColumn('users', 'boosts_balance')) {
                    $table->unsignedSmallInteger('boosts_balance')->default(0)->after('superlikes_balance');
                }

                if (! Schema::hasColumn('users', 'boost_until')) {
                    $table->timestamp('boost_until')->nullable()->after('boosts_balance');
                }

                if (! Schema::hasColumn('users', 'boost_month')) {
                    $table->string('boost_month', 7)->nullable()->after('boost_until');
                }

                if (! Schema::hasColumn('users', 'undos_day')) {
                    $table->date('undos_day')->nullable()->after('boost_month');
                }

                if (! Schema::hasColumn('users', 'undos_used')) {
                    $table->unsignedSmallInteger('undos_used')->default(0)->after('undos_day');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('swipe_actions') && Schema::hasColumn('swipe_actions', 'is_superlike')) {
            Schema::table('swipe_actions', function (Blueprint $table) {
                $table->dropColumn('is_superlike');
            });
        }
    }
};
