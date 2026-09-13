<?php

namespace App\Services;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Pin;
use App\Models\SosCall;
use App\Models\SosCallDecline;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * SOS-режим: лимиты, принятие вызова, отдельный чат.
 *
 * Лимит SOS в месяц: 1 для Free, 3 для Pro/Business. Принявший вызов
 * получает отдельный чат с создателем, оба видят только SOS-пин.
 */
class SosService
{
    /**
     * Лимит SOS на месяц и остаток пользователя.
     *
     * @param User $user
     * @return array{used:int, limit:int, left:int, is_pro:bool}
     */
    public static function limits(User $user): array
    {
        $isPro = $user->isPro();
        $limit = $isPro || $user->isAdmin()
            ? Pin::SOS_PRO_MONTH_LIMIT
            : Pin::SOS_FREE_MONTH_LIMIT;

        if ($user->isAdmin()) {
            return ['used' => 0, 'limit' => $limit, 'left' => $limit, 'is_pro' => true];
        }

        $start = Carbon::now()->startOfMonth();

        $used = Pin::where('user_id', $user->id)
            ->where('category', Pin::SOS_CATEGORY)
            ->where('created_at', '>=', $start)
            ->count();

        return [
            'used' => $used,
            'limit' => $limit,
            'left' => max(0, $limit - $used),
            'is_pro' => $isPro,
        ];
    }

    /**
     * Проверить лимит перед созданием SOS-пина.
     *
     * @param User $user
     * @return void
     */
    public static function assertSosLimit(User $user): void
    {
        if ($user->isAdmin()) {
            return;
        }

        $limits = self::limits($user);

        abort_if($limits['left'] <= 0, 429, $limits['is_pro']
            ? 'Лимит SOS исчерпан: 3 вызова в месяц на PRO.'
            : 'Лимит SOS исчерпан: 1 вызов в месяц на Free, 3 — на PRO.');
    }

    /**
     * Активный SOS-вызов пользователя (создатель или принявший).
     *
     * @param User $user
     * @return SosCall|null
     */
    public static function activeFor(User $user): ?SosCall
    {
        $call = SosCall::whereIn('status', [SosCall::STATUS_PENDING, SosCall::STATUS_ACTIVE])
            ->where(fn ($q) => $q
                ->where('creator_id', $user->id)
                ->orWhere('responder_id', $user->id))
            ->with(['pin', 'conversation'])
            ->latest('id')
            ->first();

        if (! $call || ! $call->pin) {
            return null;
        }

        $pin = $call->pin;
        $expired = $pin->status !== 'active' || ($pin->expires_at && Carbon::parse($pin->expires_at)->isPast());

        if ($expired) {
            return null;
        }

        return $call;
    }

    /**
     * Найти или создать вызов для SOS-пина.
     *
     * @param Pin $pin
     * @return SosCall
     */
    public static function callFor(Pin $pin): SosCall
    {
        return SosCall::firstOrCreate(
            ['pin_id' => $pin->id],
            ['creator_id' => $pin->user_id, 'status' => SosCall::STATUS_PENDING]
        );
    }

    /**
     * Принять SOS: стать responder, получить отдельный чат.
     *
     * @param User $user принимающий
     * @param Pin $pin SOS-пин
     * @return SosCall
     */
    public static function accept(User $user, Pin $pin): SosCall
    {
        abort_unless(Pin::isSosCategory($pin->category), 422, 'Это не SOS-пин.');
        abort_if((int) $pin->user_id === (int) $user->id, 422, 'Нельзя принять собственный SOS.');
        abort_if($pin->status !== 'active' || $pin->isExpired(), 410, 'SOS уже завершён.');

        return DB::transaction(function () use ($user, $pin) {
            $call = SosCall::where('pin_id', $pin->id)->lockForUpdate()->first();

            if (! $call) {
                $call = SosCall::create([
                    'pin_id' => $pin->id,
                    'creator_id' => $pin->user_id,
                    'status' => SosCall::STATUS_PENDING,
                ]);
            }

            abort_if($call->status === SosCall::STATUS_CLOSED, 410, 'SOS уже завершён.');
            abort_if($call->responder_id && (int) $call->responder_id !== (int) $user->id, 409, 'SOS уже принят другим человеком.');

            $creator = User::findOrFail((int) $pin->user_id);

            $conversation = $call->conversation_id
                ? Conversation::find($call->conversation_id)
                : null;

            if (! $conversation) {
                $conversation = Conversation::create([
                    'type' => 'sos',
                    'created_by' => $user->id,
                    'pin_id' => $pin->id,
                    'last_message_at' => now(),
                ]);
                $conversation->participantRows()->createMany([
                    ['user_id' => $creator->id, 'joined_at' => now()],
                    ['user_id' => $user->id, 'joined_at' => now()],
                ]);
            } else {
                $conversation->participantRows()->updateOrCreate(
                    ['user_id' => $user->id],
                    ['joined_at' => now(), 'hidden_at' => null]
                );
                $conversation->participantRows()->updateOrCreate(
                    ['user_id' => $creator->id],
                    ['joined_at' => $conversation->created_at, 'hidden_at' => null]
                );
            }

            $call->forceFill([
                'responder_id' => $user->id,
                'status' => SosCall::STATUS_ACTIVE,
                'conversation_id' => $conversation->id,
            ])->save();

            SosCallDecline::where('sos_call_id', $call->id)
                ->where('user_id', $user->id)
                ->delete();

            $message = Message::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $user->id,
                'body' => '🆘 '.mb_substr($user->name ?? 'Пользователь', 0, 60).' принял(а) SOS и готов(а) помочь.',
                'type' => 'system',
            ]);
            $conversation->forceFill(['last_message_at' => $message->created_at])->save();

            try {
                broadcast(new MessageSent($message->load('conversation.participantRows')))->toOthers();
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('reverb sos broadcast failed: '.$e->getMessage());
            }
            try {
                $push = app(WebPushService::class);
                if ($push->isConfigured()) {
                    $push->sendChatMessage($creator, $user, $conversation->id, (string) $message->body);
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('sos webpush failed: '.$e->getMessage());
            }

            return $call->fresh(['pin', 'conversation', 'responder']);
        });
    }

    /**
     * Отклонить SOS: больше не предлагать этот вызов пользователю.
     *
     * @param User $user
     * @param Pin $pin SOS-пин
     * @return void
     */
    public static function decline(User $user, Pin $pin): void
    {
        abort_unless(Pin::isSosCategory($pin->category), 422, 'Это не SOS-пин.');

        $call = self::callFor($pin);

        SosCallDecline::firstOrCreate([
            'sos_call_id' => $call->id,
            'user_id' => $user->id,
        ]);
    }
}
