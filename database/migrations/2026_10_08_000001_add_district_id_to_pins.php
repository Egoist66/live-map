<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pins', function (Blueprint $table) {
            $table->foreignId('district_id')->nullable()->after('user_id')->constrained('districts')->nullOnDelete();
            $table->index('district_id');
        });
    }

    public function down(): void
    {
        Schema::table('pins', function (Blueprint $table) {
            $table->dropConstrainedForeignId('district_id');
        });
    }
};
