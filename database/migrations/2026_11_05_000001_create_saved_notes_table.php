<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Личные заметки «Избранное» (чат только для себя).
 *
 * Тело хранится сжатым (gzip) и зашифрованным (AES-256-GCM через
 * SavedNoteCrypto) в колонке payload — в открытом виде в БД нет ничего,
 * кроме kind (text|link) для быстрой фильтрации без расшифровки.
 */
return new class extends Migration
{
    /**
     * Создать таблицу saved_notes.
     *
     * @return void
     */
    public function up(): void
    {
        Schema::create('saved_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->mediumText('payload');
            $table->string('kind', 20)->default('text');
            $table->timestamps();

            $table->index(['user_id', 'updated_at']);
        });
    }

    /**
     * Удалить таблицу saved_notes.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('saved_notes');
    }
};
