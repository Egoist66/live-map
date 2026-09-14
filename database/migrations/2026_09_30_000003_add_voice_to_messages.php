<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->unsignedSmallInteger('attachment_duration')->nullable()->after('attachment_kind');
        });
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE `messages` MODIFY `type` ENUM('text','system','image','file','voice','audio') NOT NULL DEFAULT 'text'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("UPDATE `messages` SET `type` = 'file' WHERE `type` IN ('voice','audio')");
            DB::statement("ALTER TABLE `messages` MODIFY `type` ENUM('text','system','image','file') NOT NULL DEFAULT 'text'");
        }
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn('attachment_duration');
        });
    }
};
