<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profile_photo_likes', function (Blueprint $table) {
            $table->boolean('is_incognito')->default(false)->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('profile_photo_likes', function (Blueprint $table) {
            $table->dropColumn('is_incognito');
        });
    }
};
