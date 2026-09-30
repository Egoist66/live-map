<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Скрытие анкеты + отложенное удаление с grace-периодом.
     *
     * - profile_hidden_at: анкета скрыта, никто не видит (возврат одним тапом).
     * - deletion_requested_at: пользователь нажал «удалить профиль».
     * - deletion_scheduled_at: когда реально тереть всё из базы (+14 дней).
     * - deletion_pro_until: до когда действует прощальная неделя PRO.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('profile_hidden_at')->nullable()->after('is_hidden_from_search');
            $table->timestamp('deletion_requested_at')->nullable()->after('profile_hidden_at');
            $table->timestamp('deletion_scheduled_at')->nullable()->after('deletion_requested_at');
            $table->timestamp('deletion_pro_until')->nullable()->after('deletion_scheduled_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'profile_hidden_at',
                'deletion_requested_at',
                'deletion_scheduled_at',
                'deletion_pro_until',
            ]);
        });
    }
};
