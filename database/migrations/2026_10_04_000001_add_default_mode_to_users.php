<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Стартовый режим приложения: ULove-свайпы или ULove-карта.
     * NULL у старых пользователей = показать модалку «выбери сторону».
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('default_mode', 10)->nullable()->after('signup_goal');
            $table->timestamp('default_mode_set_at')->nullable()->after('default_mode');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['default_mode_set_at', 'default_mode']);
        });
    }
};
