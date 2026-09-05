<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('default_location_precision', 16)->default('blur_200')->after('is_anonymous_default');
            $table->unsignedSmallInteger('default_blur_meters')->default(200)->after('default_location_precision');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['default_location_precision', 'default_blur_meters']);
        });
    }
};
