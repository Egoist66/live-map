<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('category', 32)->default('event')->after('type');
            $table->string('key', 191)->nullable()->after('data');
            $table->index(['notifiable_type', 'notifiable_id', 'category'], 'notifications_owner_category_idx');
            $table->unique(['notifiable_id', 'key'], 'notifications_owner_key_unique');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropUnique('notifications_owner_key_unique');
            $table->dropIndex('notifications_owner_category_idx');
            $table->dropColumn(['category', 'key']);
        });
    }
};
