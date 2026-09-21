<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('auto_reply_enabled')->default(false)->after('flow_comments_privacy');
            $table->string('auto_reply_text', 500)->nullable()->after('auto_reply_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['auto_reply_enabled', 'auto_reply_text']);
        });
    }
};
