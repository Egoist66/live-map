<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pins', function (Blueprint $table) {
            $table->string('photo_path')->nullable()->after('body');
            $table->decimal('real_lat', 10, 7)->nullable()->after('longitude');
            $table->decimal('real_lng', 10, 7)->nullable()->after('real_lat');
            $table->enum('location_precision', ['blur_200', 'exact', 'district'])->default('blur_200')->after('real_lng');
            $table->smallInteger('visibility_radius_km')->unsigned()->default(1)->after('location_precision');
            $table->enum('status', ['active', 'expired', 'archived', 'deleted'])->default('active')->after('visibility_radius_km');
            $table->enum('priority', ['normal', 'boosted', 'sponsored'])->default('normal')->after('status');
            $table->integer('reactions_count')->unsigned()->default(0)->after('likes_count');
            $table->integer('comments_count')->unsigned()->default(0)->after('reactions_count');
            $table->boolean('is_anonymous')->default(false)->after('comments_count');
            $table->string('district_name', 100)->nullable()->after('is_anonymous');
        });
    }

    public function down(): void
    {
        Schema::table('pins', function (Blueprint $table) {
            $table->dropColumn(['photo_path', 'real_lat', 'real_lng', 'location_precision', 'visibility_radius_km', 'status', 'priority', 'reactions_count', 'comments_count', 'is_anonymous', 'district_name']);
        });
    }
};
