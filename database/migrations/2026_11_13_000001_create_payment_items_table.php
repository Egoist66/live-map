<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Витрина платных позиций: цены планов, пакеты кредитов, фишки и реклама.
 *
 * Админка «Payments» правит строки — приложение подхватывает их само:
 * PlanCatalog читает оверрайды цен планов, каталог для фронта отдаёт
 * активные позиции. Шлюз оплаты подключается позже, таблица — его витрина.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_items', function (Blueprint $table) {
            $table->id();
            $table->string('key', 64)->unique();
            $table->string('module', 32)->default('general');
            $table->string('kind', 32)->default('feature');
            $table->string('name', 120);
            $table->string('description', 500)->nullable();
            $table->decimal('price', 10, 2)->nullable();
            $table->string('currency', 8)->default('USD');
            $table->string('period', 16)->nullable();
            $table->json('payload')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['module', 'is_active']);
            $table->index(['kind', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_items');
    }
};
