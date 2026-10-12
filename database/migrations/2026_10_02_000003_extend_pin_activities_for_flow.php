<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Добавляет flow-связи к pin_activities. Идемпотентна.
     */
    public function up(): void
    {
        if (! Schema::hasTable('pin_activities')) {
            return;
        }

        if (! Schema::hasColumn('pin_activities', 'flow_post_id')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $column = $table->foreignId('flow_post_id')->nullable();

                if (Schema::hasColumn('pin_activities', 'photo_id')) {
                    $column->after('photo_id');
                }

                $column->constrained('flow_posts')->cascadeOnDelete();
            });
        }

        if (! Schema::hasColumn('pin_activities', 'flow_comment_id')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $table->foreignId('flow_comment_id')->nullable()->after('flow_post_id')->constrained('flow_post_comments')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('pin_activities')) {
            return;
        }

        if (Schema::hasColumn('pin_activities', 'flow_comment_id')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $table->dropConstrainedForeignId('flow_comment_id');
            });
        }

        if (Schema::hasColumn('pin_activities', 'flow_post_id')) {
            Schema::table('pin_activities', function (Blueprint $table) {
                $table->dropConstrainedForeignId('flow_post_id');
            });
        }
    }
};
