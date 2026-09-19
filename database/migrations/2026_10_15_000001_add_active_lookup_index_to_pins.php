<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Композитный индекс для горячего чтения карты.
 *
 * `Pin::scopeActive()` на каждом `GET /pins` фильтрует по
 * `status + expires_at (+ publish_at)`, а отдельных индексов под эту
 * связку не было — только одиночный `expires_at`. Без композита MySQL
 * перебирает лишние строки при каждом скролле карты.
 *
 * Миграция чисто аддитивная: только `CREATE INDEX`, логика не меняется,
 * откат — `DROP INDEX`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pins', function (Blueprint $table) {
            $table->index(['status', 'expires_at'], 'pins_status_expires_idx');
        });
    }

    public function down(): void
    {
        Schema::table('pins', function (Blueprint $table) {
            $table->dropIndex('pins_status_expires_idx');
        });
    }
};
