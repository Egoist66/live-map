<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Изоляция модулей: какие разделы включены у пользователя.
     * JSON-массив из ulove|upin|uflow|districts|business.
     * NULL = legacy-режим (все модули включены, как раньше).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('enabled_modules')->nullable()->after('default_mode_set_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('enabled_modules');
        });
    }
};
