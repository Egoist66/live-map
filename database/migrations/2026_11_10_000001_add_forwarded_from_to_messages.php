<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Автор оригинала для пересланных сообщений.
     *
     * Без снапшота: имя/аватар всегда живые через связь,
     * поэтому переименование пользователя не ломает подпись
     * «Переслано от ...» в старых копиях.
     */
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->foreignId('forwarded_from_id')
                ->nullable()
                ->after('sender_id')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('forwarded_from_id');
        });
    }
};
