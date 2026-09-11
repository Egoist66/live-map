<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pin_activities', function (Blueprint $table) {
            $table->foreignId('flow_post_id')->nullable()->after('photo_id')->constrained('flow_posts')->cascadeOnDelete();
            $table->foreignId('flow_comment_id')->nullable()->after('flow_post_id')->constrained('flow_post_comments')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('pin_activities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('flow_comment_id');
            $table->dropConstrainedForeignId('flow_post_id');
        });
    }
};
