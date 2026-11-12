<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Одноразовая очистка уведомлений и непрочитанных сообщений у всех.
 *
 * Административная операция по запросу: удаляются все строки inbox
 * (включая пользователей, пришедших из Telegram), входящие сообщения
 * помечаются прочитанными и доставленными, участники диалогов получают
 * свежий last_read_at. Каналы уведомлений (Telegram/push/email) и
 * пользовательские тумблеры не отключаются — новые уведомления
 * продолжат приходить как обычно.
 *
 * Диалоги с погашенными непрочитанными получают updated_at, чтобы
 * дельта-синк клиента сбросил протухший unread_count. Кеш бейджей
 * сбрасывается, иначе колокольчик держал бы старую цифру до TTL.
 */
return new class extends Migration
{
    /**
     * Выполнить очистку.
     */
    public function up(): void
    {
        $now = now();

        DB::table('notifications')->delete();

        $unreadConversationIds = DB::table('messages')
            ->whereNull('read_at')
            ->distinct()
            ->pluck('conversation_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->values();

        DB::table('messages')
            ->whereNull('read_at')
            ->update(['read_at' => $now]);

        DB::table('messages')
            ->whereNull('delivered_at')
            ->update(['delivered_at' => $now]);

        DB::table('conversation_participants')
            ->update(['last_read_at' => $now]);

        foreach ($unreadConversationIds->chunk(500) as $chunk) {
            DB::table('conversations')
                ->whereIn('id', $chunk->all())
                ->update(['updated_at' => $now]);
        }

        $this->forgetBadgeCaches();
    }

    /**
     * Очистка необратима: старые уведомления не восстанавливаются.
     */
    public function down(): void
    {
        //
    }

    /**
     * Сбросить кеш счётчиков всех пользователей.
     */
    private function forgetBadgeCaches(): void
    {
        DB::table('users')
            ->select('id')
            ->orderBy('id')
            ->chunk(500, function ($users): void {
                foreach ($users as $user) {
                    Cache::forget('realtime:badges:'.(int) $user->id);
                }
            });
    }
};
