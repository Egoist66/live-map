<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pins', function (Blueprint $table) {
            $table->string('country', 120)->nullable()->after('district_name');
            $table->string('country_code', 8)->nullable()->after('country');
            $table->index(['country_code']);
        });

        Schema::create('pin_invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pin_id')->constrained('pins')->cascadeOnDelete();
            $table->foreignId('inviter_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('invitee_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['pending', 'accepted'])->default('pending');
            $table->timestamps();
            $table->unique(['pin_id', 'invitee_id']);
            $table->index(['invitee_id', 'status']);
            $table->index(['pin_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pin_invites');
        Schema::table('pins', function (Blueprint $table) {
            $table->dropIndex(['country_code']);
            $table->dropColumn(['country', 'country_code']);
        });
    }
};
