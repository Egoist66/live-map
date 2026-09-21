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
            $table->string('shared_post_type', 16)->nullable()->after('reply_to_id');
            $table->unsignedBigInteger('shared_post_id')->nullable()->after('shared_post_type');
            $table->index(['shared_post_type', 'shared_post_id']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE `messages` MODIFY `type` ENUM('text','system','image','file','voice','audio','post') NOT NULL DEFAULT 'text'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("UPDATE `messages` SET `type` = 'text' WHERE `type` = 'post'");
            DB::statement("ALTER TABLE `messages` MODIFY `type` ENUM('text','system','image','file','voice','audio') NOT NULL DEFAULT 'text'");
        }

        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['shared_post_type', 'shared_post_id']);
            $table->dropColumn(['shared_post_type', 'shared_post_id']);
        });
    }
};
