<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expo_push_tokens', function (Blueprint $table) {
            $table->string('platform', 32)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('expo_push_tokens', function (Blueprint $table) {
            $table->string('platform', 16)->nullable()->change();
        });
    }
};
