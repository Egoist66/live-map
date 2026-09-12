<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Удаление таблиц, заменённых единой inbox-таблицей notifications:
     * pin_activities (лента переехала, backfill выполнен командой
     * notifications:backfill) и app_update_reads (прочтения в inbox).
     */
    public function up(): void
    {
        Schema::dropIfExists('pin_activities');
        Schema::dropIfExists('app_update_reads');
    }

    public function down(): void
    {
        // Таблицы не восстанавливаются: данные живут в notifications.
    }
};
