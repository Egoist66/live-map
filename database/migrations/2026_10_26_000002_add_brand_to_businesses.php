<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Бренд организации: витринное название для поиска и показа.
 *
 * Юрназвание (name) часто канцелярское («ООО Ромашка»),
 * а клиенты ищут бренд («Кофейня у парка»). Поиск организаций
 * идёт по name + brand.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('brand', 255)->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn('brand');
        });
    }
};
