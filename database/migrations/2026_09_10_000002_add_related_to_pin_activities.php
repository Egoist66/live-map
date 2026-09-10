<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pin_activities', function (Blueprint $table) {
            $table->foreignId('related_user_id')->nullable()->after('photo_comment_id')->constrained('users')->nullOnDelete();
            $table->boolean('is_incognito')->default(false)->after('related_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('pin_activities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('related_user_id');
            $table->dropColumn('is_incognito');
        });
    }
};
