<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_attempts', function (Blueprint $table) {
            $table->id();
            $table->string('email', 191)->index();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('ip', 45)->nullable()->index();
            $table->string('country', 120)->nullable();
            $table->string('country_code', 8)->nullable();
            $table->string('city', 120)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->boolean('successful')->default(false);
            $table->timestamp('created_at')->nullable()->index();
            $table->index(['email', 'created_at']);
            $table->index(['ip', 'created_at']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('banned_at')->nullable()->after('remember_token');
            $table->string('banned_reason', 255)->nullable()->after('banned_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['banned_at', 'banned_reason']);
        });
        Schema::dropIfExists('login_attempts');
    }
};
