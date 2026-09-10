<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Чистит дубли уведомлений: generic-строка «комментарий» + «упоминание»
     * на один и тот же коммент. Оставляем только упоминание.
     */
    public function up(): void
    {
        $pinDupIds = DB::table('pin_activities as generic')
            ->select('generic.id')
            ->where('generic.kind', 'comment')
            ->whereNull('generic.read_at')
            ->whereNotNull('generic.comment_id')
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('pin_activities as mention')
                    ->where('mention.kind', 'mention')
                    ->whereNull('mention.read_at')
                    ->whereColumn('mention.owner_id', 'generic.owner_id')
                    ->whereColumn('mention.comment_id', 'generic.comment_id');
            })
            ->pluck('id')
            ->all();

        if ($pinDupIds) {
            DB::table('pin_activities')->whereIn('id', $pinDupIds)->delete();
        }

        $photoDupIds = DB::table('pin_activities as generic')
            ->select('generic.id')
            ->where('generic.kind', 'photo_comment')
            ->whereNull('generic.read_at')
            ->whereNotNull('generic.photo_comment_id')
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('pin_activities as mention')
                    ->where('mention.kind', 'mention')
                    ->whereNull('mention.read_at')
                    ->whereColumn('mention.owner_id', 'generic.owner_id')
                    ->whereColumn('mention.photo_comment_id', 'generic.photo_comment_id');
            })
            ->pluck('id')
            ->all();

        if ($photoDupIds) {
            DB::table('pin_activities')->whereIn('id', $photoDupIds)->delete();
        }
    }

    public function down(): void
    {
    }
};
