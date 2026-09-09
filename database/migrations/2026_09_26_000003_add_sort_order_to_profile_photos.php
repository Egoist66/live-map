<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profile_photos', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->after('caption');
            $table->index(['user_id', 'sort_order']);
        });

        $photoIds = DB::table('profile_photos')
            ->orderBy('user_id')
            ->orderBy('created_at')
            ->orderBy('id')
            ->pluck('id', 'id');

        $currentUserId = null;
        $position = 0;

        foreach ($photoIds as $photoId) {
            $ownerId = DB::table('profile_photos')->where('id', $photoId)->value('user_id');

            if ($ownerId !== $currentUserId) {
                $currentUserId = $ownerId;
                $position = 0;
            }

            DB::table('profile_photos')->where('id', $photoId)->update(['sort_order' => $position]);
            $position++;
        }
    }

    public function down(): void
    {
        Schema::table('profile_photos', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'sort_order']);
            $table->dropColumn('sort_order');
        });
    }
};
