<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Пин ответов треда Pipe (как в Instagram): автор треда закрепляет
 * до 3 ответов верхнего уровня — они всегда сверху ветки.
 */
return new class extends Migration
{
    /**
     * Добавить флаг и время закрепления в pipe_replies.
     */
    public function up(): void
    {
        Schema::table('pipe_replies', function (Blueprint $table) {
            $table->boolean('is_pinned')->default(false)->after('is_anonymous');
            $table->timestamp('pinned_at')->nullable()->after('is_pinned');

            $table->index(['thread_id', 'is_pinned', 'pinned_at']);
        });
    }

    /**
     * Откатить изменения.
     */
    public function down(): void
    {
        Schema::table('pipe_replies', function (Blueprint $table) {
            $table->dropIndex(['thread_id', 'is_pinned', 'pinned_at']);
            $table->dropColumn(['pinned_at', 'is_pinned']);
        });
    }
};
