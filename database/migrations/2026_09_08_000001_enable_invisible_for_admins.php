<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where(fn ($q) => $q->where('is_admin', true)->orWhere('role', 'admin'))
            ->where('is_invisible', false)
            ->update(['is_invisible' => true]);
    }

    public function down(): void
    {
    }
};
