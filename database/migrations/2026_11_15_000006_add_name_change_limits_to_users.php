<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Лимит смены имени (никнейма) профиля.
 *
 * - name_changes_used: сколько раз человек уже сменил имя —
 *   бесплатная смена одна; на Premium/Business и у персонала
 *   лимита нет (см. User::canChangeName).
 * - name_changed_at: когда сменили имя в последний раз.
 */
return new class extends Migration
{
    /**
     * @return void
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('name_changes_used')->default(0)->after('name');
            $table->timestamp('name_changed_at')->nullable()->after('name_changes_used');
        });
    }

    /**
     * @return void
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['name_changes_used', 'name_changed_at']);
        });
    }
};
