<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Модерация отзывов ULove: сначала одобрение админом/модератором,
 * потом публикация в профиле и карточках свайпов.
 *
 * - status: pending | approved | rejected. Существующие отзывы
 *   бэкфиллим в approved — они уже живут в профилях и сводках.
 * - moderator_id / moderated_at: кто и когда принял решение.
 */
return new class extends Migration
{
    /**
     * @return void
     */
    public function up(): void
    {
        Schema::table('dating_reviews', function (Blueprint $table) {
            $table->string('status', 16)->default('pending')->after('body');
            $table->foreignId('moderator_id')
                ->nullable()
                ->after('status')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('moderated_at')->nullable()->after('moderator_id');

            $table->index(['status', 'created_at']);
            $table->index(['status', 'target_id']);
        });

        DB::table('dating_reviews')->update(['status' => 'approved']);
    }

    /**
     * @return void
     */
    public function down(): void
    {
        Schema::table('dating_reviews', function (Blueprint $table) {
            $table->dropIndex(['status', 'created_at']);
            $table->dropIndex(['status', 'target_id']);
            $table->dropConstrainedForeignId('moderator_id');
            $table->dropColumn(['status', 'moderated_at']);
        });
    }
};
