<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->timestamp('pinned_at')->nullable()->after('edited_at');
            $table->foreignId('pinned_by')->nullable()->after('pinned_at')->constrained('users')->nullOnDelete();
            $table->index(['conversation_id', 'pinned_at']);
        });
    }
    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['conversation_id', 'pinned_at']);
            $table->dropConstrainedForeignId('pinned_by');
            $table->dropColumn('pinned_at');
        });
    }
};
