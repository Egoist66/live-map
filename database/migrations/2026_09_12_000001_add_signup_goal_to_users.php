<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Цель захода в приложение: ULove-цели ведут в свайпы, карта — на карту.
     *
     * Идемпотентна: dating_goal создаётся позже (2026_09_26),
     * поэтому позиция колонки выбирается по факту наличия.
     */
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        if (Schema::hasColumn('users', 'signup_goal')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $column = $table->string('signup_goal', 20)->nullable();

            if (Schema::hasColumn('users', 'dating_goal')) {
                $column->after('dating_goal');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        if (! Schema::hasColumn('users', 'signup_goal')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('signup_goal');
        });
    }
};
