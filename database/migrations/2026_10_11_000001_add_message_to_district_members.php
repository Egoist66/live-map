<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Цель вступления в район: организации указывают её обязательно
     * (модалка при заявке), персоны — по желанию. Организатор видит
     * цель в табе «Заявки» и решает: принять, отклонить или связаться.
     */
    public function up(): void
    {
        Schema::table('district_members', function (Blueprint $table) {
            $table->string('message', 500)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('district_members', function (Blueprint $table) {
            $table->dropColumn('message');
        });
    }
};
