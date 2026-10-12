<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Автоответы. Идемпотентна: flow_comments_privacy создаётся позже (2026_10_12).
     */
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        if (! Schema::hasColumn('users', 'auto_reply_enabled')) {
            Schema::table('users', function (Blueprint $table) {
                $column = $table->boolean('auto_reply_enabled')->default(false);

                if (Schema::hasColumn('users', 'flow_comments_privacy')) {
                    $column->after('flow_comments_privacy');
                }
            });
        }

        if (! Schema::hasColumn('users', 'auto_reply_text')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('auto_reply_text', 500)->nullable()->after('auto_reply_enabled');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        $drop = [];

        if (Schema::hasColumn('users', 'auto_reply_enabled')) {
            $drop[] = 'auto_reply_enabled';
        }

        if (Schema::hasColumn('users', 'auto_reply_text')) {
            $drop[] = 'auto_reply_text';
        }

        if ($drop === []) {
            return;
        }

        Schema::table('users', function (Blueprint $table) use ($drop) {
            $table->dropColumn($drop);
        });
    }
};
