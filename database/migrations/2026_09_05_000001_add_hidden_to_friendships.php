<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('friendships', function (Blueprint $table) {
            $table->boolean('hidden_by_requester')->default(false)->after('status');
            $table->boolean('hidden_by_addressee')->default(false)->after('hidden_by_requester');
        });
    }

    public function down(): void
    {
        Schema::table('friendships', function (Blueprint $table) {
            $table->dropColumn(['hidden_by_requester', 'hidden_by_addressee']);
        });
    }
};
