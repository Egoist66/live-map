<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('legal_form', 32)->default('ooo')->after('category');
            $table->string('unp', 16)->nullable()->after('legal_form');
            $table->string('reg_number', 64)->nullable()->after('unp');
            $table->string('legal_address', 255)->nullable()->after('address');
            $table->string('director_name', 255)->nullable()->after('legal_address');
            $table->string('verification_status', 16)->default('draft')->after('is_active');
            $table->text('verification_notes')->nullable()->after('verification_status');
            $table->timestamp('verified_at')->nullable()->after('verification_notes');
            $table->string('logo_path', 255)->nullable()->after('verified_at');
            $table->index('unp');
            $table->index('verification_status');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropIndex(['unp']);
            $table->dropIndex(['verification_status']);
            $table->dropColumn([
                'legal_form',
                'unp',
                'reg_number',
                'legal_address',
                'director_name',
                'verification_status',
                'verification_notes',
                'verified_at',
                'logo_path',
            ]);
        });
    }
};
