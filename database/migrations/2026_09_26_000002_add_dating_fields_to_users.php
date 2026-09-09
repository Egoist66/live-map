<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('dating_enabled')->default(true)->after('is_hidden_from_search');
            $table->string('dating_goal', 20)->nullable()->after('dating_enabled');
            $table->json('dating_interests')->nullable()->after('dating_goal');
            $table->string('dating_gender_pref', 10)->default('all')->after('dating_interests');
            $table->boolean('dating_hide_name')->default(false)->after('dating_gender_pref');
            $table->boolean('dating_hide_age')->default(false)->after('dating_hide_name');
            $table->boolean('dating_match_only')->default(false)->after('dating_hide_age');
            $table->unsignedSmallInteger('random_chats_used')->default(0)->after('dating_match_only');
            $table->char('random_chats_month', 7)->nullable()->after('random_chats_used');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'dating_enabled',
                'dating_goal',
                'dating_interests',
                'dating_gender_pref',
                'dating_hide_name',
                'dating_hide_age',
                'dating_match_only',
                'random_chats_used',
                'random_chats_month',
            ]);
        });
    }
};
