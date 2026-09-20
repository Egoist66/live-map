<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Расширяет короткие текстовые колонки до TEXT под AES-256-GCM шифротекст.
 *
 * Шифротекст длиннее plaintext (~+60 символов base64-обвязки): VARCHAR(60..1000)
 * обрезал бы его и данные потерялись бы безвозвратно. Только widen — сами
 * значения трогает команда privacy:encrypt-texts после деплоя.
 */
return new class extends Migration
{
    /**
     * Расширить колонки до TEXT (MySQL MODIFY, идемпотентно).
     *
     * @return void
     */
    public function up(): void
    {
        $this->modifyToText('profile_photo_comments', 'content', false);
        $this->modifyToText('users', 'thought', true);
        $this->modifyToText('users', 'dating_custom_goal', true);
    }

    /**
     * Вернуть исходные VARCHAR (данные-шифротекст при этом обрежутся!).
     *
     * @return void
     */
    public function down(): void
    {
        $this->modifyColumn('profile_photo_comments', 'content', 'VARCHAR(1000) NOT NULL');
        $this->modifyColumn('users', 'thought', 'VARCHAR(140) NULL');
        $this->modifyColumn('users', 'dating_custom_goal', 'VARCHAR(60) NULL');
    }

    /**
     * Перевести колонку в TEXT с сохранением nullability.
     *
     * @param string $table
     * @param string $column
     * @param bool $nullable
     * @return void
     */
    private function modifyToText(string $table, string $column, bool $nullable): void
    {
        $null = $nullable ? 'NULL' : 'NOT NULL';

        $this->modifyColumn($table, $column, "TEXT {$null}");
    }

    /**
     * Выполнить ALTER только если таблица и колонка существуют.
     *
     * @param string $table
     * @param string $column
     * @param string $definition
     * @return void
     */
    private function modifyColumn(string $table, string $column, string $definition): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        DB::statement("ALTER TABLE `{$table}` MODIFY COLUMN `{$column}` {$definition}");
    }
};
