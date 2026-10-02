<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Вложения «Избранного»: чат с собой умеет картинки и файлы, как диалог
 * с человеком. Метаданные вложения лежат открытыми рядом с kind —
 * сами файлы хранятся на диске вложений (см. ChatAttachment).
 */
return new class extends Migration
{
    /**
     * Добавить колонки вложения к заметкам.
     *
     * @return void
     */
    public function up(): void
    {
        Schema::table('saved_notes', function (Blueprint $table) {
            $table->string('attachment_path', 512)->nullable()->after('kind');
            $table->string('attachment_name', 255)->nullable()->after('attachment_path');
            $table->string('attachment_mime', 127)->nullable()->after('attachment_name');
            $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_mime');
            $table->string('attachment_kind', 20)->nullable()->after('attachment_size');
        });
    }

    /**
     * Убрать колонки вложения.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::table('saved_notes', function (Blueprint $table) {
            $table->dropColumn(['attachment_path', 'attachment_name', 'attachment_mime', 'attachment_size', 'attachment_kind']);
        });
    }
};
