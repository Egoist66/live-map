<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Общий фон чата: видит вся беседа, меняется у всех сразу.
     * type: none|preset|color|image. Картинка лежит в сторедже
     * (chat-wallpapers), а не в IndexedDB — поэтому не теряется
     * и одинакова на всех устройствах обоих собеседников.
     */
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->string('wallpaper_type', 16)->nullable()->after('district_id');
            $table->string('wallpaper_preset', 32)->nullable()->after('wallpaper_type');
            $table->string('wallpaper_color', 16)->nullable()->after('wallpaper_preset');
            $table->string('wallpaper_image_path', 255)->nullable()->after('wallpaper_color');
            $table->timestamp('wallpaper_updated_at')->nullable()->after('wallpaper_image_path');
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropColumn([
                'wallpaper_type',
                'wallpaper_preset',
                'wallpaper_color',
                'wallpaper_image_path',
                'wallpaper_updated_at',
            ]);
        });
    }
};
