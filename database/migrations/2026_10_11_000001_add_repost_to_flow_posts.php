<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('flow_posts', function (Blueprint $table) {
            $table->foreignId('repost_of_id')->nullable()->after('user_id')->constrained('flow_posts')->nullOnDelete();
            $table->unsignedInteger('reposts_count')->default(0)->after('comments_count');
        });
    }

    public function down(): void
    {
        Schema::table('flow_posts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('repost_of_id');
            $table->dropColumn('reposts_count');
        });
    }
};
