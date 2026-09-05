<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public const CATEGORIES = [
        'question', 'announcement', 'warning', 'event', 'offer', 'help',
        'sport', 'food', 'music', 'pets', 'sale', 'job',
        'study', 'travel', 'tech', 'health', 'art', 'humor',
    ];

    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $list = implode(',', array_map(fn ($c) => "'{$c}'", self::CATEGORIES));
            DB::statement("ALTER TABLE pins MODIFY category ENUM({$list}) DEFAULT 'announcement'");
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $extra = implode(',', array_map(fn ($c) => "'{$c}'", array_diff(self::CATEGORIES, ['question', 'announcement', 'warning', 'event', 'offer', 'help'])));
            DB::statement("UPDATE pins SET category='announcement' WHERE category IN ({$extra})");
            DB::statement("ALTER TABLE pins MODIFY category ENUM('question','announcement','warning','event','offer','help') DEFAULT 'announcement'");
        }
    }
};
