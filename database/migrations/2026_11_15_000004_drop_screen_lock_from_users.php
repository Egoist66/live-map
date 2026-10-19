<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Скринлокер стал локальной настройкой устройства (IndexedDB).
     *
     * Код блокировки больше не хранится на бэкенде: это приватная
     * настройка браузера, как в Telegram, и не должна синхронизироваться
     * между устройствами.
     */
    public function up(): void
    {
        $columns = array_values(array_filter([
            Schema::hasColumn('users', 'screen_lock_code') ? 'screen_lock_code' : null,
            Schema::hasColumn('users', 'screen_lock_timeout') ? 'screen_lock_timeout' : null,
            Schema::hasColumn('users', 'screen_lock_kind') ? 'screen_lock_kind' : null,
        ]));

        if ($columns === []) {
            return;
        }

        Schema::table('users', function (Blueprint $table) use ($columns) {
            $table->dropColumn($columns);
        });
    }

    public function down(): void
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
};
