<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Добавляет флаг инкогнито к лайкам фото.
     *
     * Идемпотентна: на свежей БД таблица profile_photo_likes создаётся
     * позже (2026_09_22), поэтому пропуск без таблицы — норма.
     * Сам create уже содержит колонку, повторный прогон безопасен.
     */
    public function up(): void
    {
        if (! Schema::hasTable('profile_photo_likes')) {
            return;
        }

        if (Schema::hasColumn('profile_photo_likes', 'is_incognito')) {
            return;
        }

        Schema::table('profile_photo_likes', function (Blueprint $table) {
            $table->boolean('is_incognito')->default(false)->after('user_id');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('profile_photo_likes')) {
            return;
        }

        if (! Schema::hasColumn('profile_photo_likes', 'is_incognito')) {
            return;
        }

        Schema::table('profile_photo_likes', function (Blueprint $table) {
            $table->dropColumn('is_incognito');
        });
    }
};
