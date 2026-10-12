<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        if (Schema::hasColumn('users', 'flow_comments_privacy')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $column = $table->string('flow_comments_privacy', 16)->default('everyone');

            if (Schema::hasColumn('users', 'photo_comments_privacy')) {
                $column->after('photo_comments_privacy');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        if (! Schema::hasColumn('users', 'flow_comments_privacy')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('flow_comments_privacy');
        });
    }
};
