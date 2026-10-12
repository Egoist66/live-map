<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Добавляет связь с пользователем и флаг инкогнито к активностям пина.
     *
     * Миграция идемпотентна и не зависит от порядка выполнения
     * с 2026_09_23_000001 (photo_comment_id может ещё не существовать
     * на свежей БД — тогда колонка встанет после comment_id).
     */
    public function up(): void
    {
        if (! Schema::hasTable('pin_activities')) {
            return;
        }

        $afterRelated = null;

        if (Schema::hasColumn('pin_activities', 'photo_comment_id')) {
            $afterRelated = 'photo_comment_id';
        } elseif (Schema::hasColumn('pin_activities', 'comment_id')) {
            $afterRelated = 'comment_id';
        }

        if (! Schema::hasColumn('pin_activities', 'related_user_id')) {
            Schema::table('pin_activities', function (Blueprint $table) use ($afterRelated) {
                $column = $table->foreignId('related_user_id')->nullable();

                if ($afterRelated !== null) {
                    $column->after($afterRelated);
                }

                $column->constrained('users')->nullOnDelete();
            });
        }

        if (! Schema::hasColumn('pin_activities', 'is_incognito')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $table->boolean('is_incognito')->default(false)->after('related_user_id');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('pin_activities')) {
            return;
        }

        if (Schema::hasColumn('pin_activities', 'is_incognito')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $table->dropColumn('is_incognito');
            });
        }

        if (Schema::hasColumn('pin_activities', 'related_user_id')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $table->dropConstrainedForeignId('related_user_id');
            });
        }
    }
};
