<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->string('key', 191)->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });
        DB::table('app_settings')->upsert([
            ['key' => 'maintenance.enabled', 'value' => '0', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'maintenance.title', 'value' => 'Технические работы', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'maintenance.message', 'value' => 'Мы обновляем UPin, чтобы он стал ещё лучше. Загляните чуть позже — обычно это занимает не больше часа.', 'created_at' => now(), 'updated_at' => now()],
        ], ['key'], ['value', 'updated_at']);
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
