<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swipe_actions', function (Blueprint $table) {
            $table->boolean('is_incognito')->default(false)->after('action');
        });
    }

    public function down(): void
    {
        Schema::table('swipe_actions', function (Blueprint $table) {
            $table->dropColumn('is_incognito');
        });
    }
};
