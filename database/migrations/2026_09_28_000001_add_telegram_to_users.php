<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->bigInteger('telegram_id')->nullable()->unique()->after('remember_token');
            $table->string('telegram_username', 64)->nullable()->after('telegram_id');
            $table->string('telegram_photo_url', 512)->nullable()->after('telegram_username');
            $table->timestamp('telegram_linked_at')->nullable()->after('telegram_photo_url');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['telegram_id']);
            $table->dropColumn(['telegram_id', 'telegram_username', 'telegram_photo_url', 'telegram_linked_at']);
        });
    }
};
