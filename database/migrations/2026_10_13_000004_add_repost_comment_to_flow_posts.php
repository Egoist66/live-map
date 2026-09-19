<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('flow_posts', function (Blueprint $table) {
            $table->text('repost_comment')->nullable()->after('repost_of_id');
        });
    }

    public function down(): void
    {
        Schema::table('flow_posts', function (Blueprint $table) {
            $table->dropColumn('repost_comment');
        });
    }
};
