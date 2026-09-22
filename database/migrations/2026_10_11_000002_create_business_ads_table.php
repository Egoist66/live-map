<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Реклама проверенного бизнеса: новости и акции компании.
     *
     * Анти-спам — не схемой, а лимитом приложения: максимум 3 рекламы
     * за скользящие 7 дней на бизнес (BusinessAdController::assertWeeklyLimit).
     */
    public function up(): void
    {
        Schema::create('business_ads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained('businesses')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 100);
            $table->string('body', 1000);
            $table->timestamps();
            $table->index(['business_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_ads');
    }
};
