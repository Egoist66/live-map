<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Превью галереи (480px): сетка ~84px/ячейка, оригинал 1440px/400КБ
     * избыточен (Lighthouse `image-delivery-insight` −1МБ). Колонка
     * nullable: старые фото без превью откатываются на оригинал.
     */
    public function up(): void
    {
        Schema::table('profile_photos', function (Blueprint $table): void {
            $table->string('thumb_path')->nullable()->after('path');
        });
    }

    public function down(): void
    {
        Schema::table('profile_photos', function (Blueprint $table): void {
            $table->dropColumn('thumb_path');
        });
    }
};
