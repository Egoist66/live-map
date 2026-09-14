<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Лайки/комменты/упоминания фото галереи — это «События», а не «Пины».
     */
    public function up(): void
    {
        DB::table('notifications')
            ->whereIn('type', ['photo.liked', 'photo.commented', 'photo.mention', 'photo.published'])
            ->where('category', 'pin')
            ->update(['category' => 'event']);
    }

    public function down(): void
    {
        DB::table('notifications')
            ->whereIn('type', ['photo.liked', 'photo.commented', 'photo.mention', 'photo.published'])
            ->where('category', 'event')
            ->update(['category' => 'pin']);
    }
};
