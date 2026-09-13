<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        try {
            DB::statement("ALTER TABLE users MODIFY level VARCHAR(32) NOT NULL DEFAULT 'novice'");
        } catch (\Throwable) {
            try {
                Schema::table('users', function (Blueprint $table) {
                    $table->string('level_tmp', 32)->default('novice');
                });
            } catch (\Throwable) {
            }
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'quest_cooldown_until')) {
                $table->timestamp('quest_cooldown_until')->nullable()->after('plan_expires_at');
            }
            if (! Schema::hasColumn('users', 'quest_last_track')) {
                $table->string('quest_last_track', 16)->nullable()->after('quest_cooldown_until');
            }
            if (! Schema::hasColumn('users', 'quest_granted_at')) {
                $table->timestamp('quest_granted_at')->nullable()->after('quest_last_track');
            }
        });

        if (! Schema::hasTable('user_quest_progress')) {
            Schema::create('user_quest_progress', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('track', 16);
                $table->string('code', 64);
                $table->unsignedInteger('progress')->default(0);
                $table->unsignedInteger('target')->default(1);
                $table->boolean('is_completed')->default(false);
                $table->timestamp('completed_at')->nullable();
                $table->string('cycle_key', 7);
                $table->boolean('xp_awarded')->default(false);
                $table->timestamps();
                $table->unique(['user_id', 'track', 'code', 'cycle_key'], 'uq_user_quest_cycle');
                $table->index(['user_id', 'cycle_key']);
            });
        }

        if (! Schema::hasTable('quest_rewards')) {
            Schema::create('quest_rewards', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('track', 16);
                $table->string('cycle_key', 7);
                $table->timestamp('granted_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->timestamp('cooldown_until')->nullable();
                $table->timestamps();
                $table->index(['user_id', 'granted_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('quest_rewards');
        Schema::dropIfExists('user_quest_progress');
        Schema::table('users', function (Blueprint $table) {
            $cols = ['quest_cooldown_until', 'quest_last_track', 'quest_granted_at'];
            foreach ($cols as $col) {
                try {
                    $table->dropColumn($col);
                } catch (\Throwable) {
                }
            }
        });
    }
};
