<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('dating_about')->nullable()->after('dating_interests');
            $table->string('dating_custom_goal', 60)->nullable()->after('dating_about');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['dating_about', 'dating_custom_goal']);
        });
    }
};
