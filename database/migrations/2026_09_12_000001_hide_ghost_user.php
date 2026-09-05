<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('id', 4)->update(['is_hidden_from_search' => true]);
    }

    public function down(): void {}
};
