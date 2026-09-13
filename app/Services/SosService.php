<?php

namespace App\Services;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Pin;
use App\Models\SosCall;
use App\Models\SosCallDecline;
use App\Models\User;
use App\Notifications\SosChatClosedNotification;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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

    /**
     * Завершить SOS-чат пина: архив истории каждому + скрытие у обоих + уведомления.
     *
     * Вызывается при закрытии создателем, удалении пина и истечении срока.
     * Идемпотентно: повтор с тем же pin_id ничего не дублирует.
     *
     * Механика:
     * - история сообщений собирается в .txt и кладётся в chat-archives;
     * - каждому участнику создаётся своё Message с вложением (sender = он),
     *   поэтому файл виден в «Архив» (вложения) каждого;
     * - диалог скрывается у ОБОИХ (hidden_at + cleared_at), из списка пропадает;
     * - обоим шлётся SosChatClosedNotification: websocket user.{id}
     *   + realtime-bus polling + web-push (внутри UserNotifier::send).
     *
     * @param Pin $pin завершённый SOS-пин
     * @param string $reason closed|deleted|expired
     * @return int|null id зачищенного диалога
     */
    public static function cleanupConversationForPin(Pin $pin, string $reason = 'closed'): ?int
    {
        $reason = in_array($reason, ['closed', 'deleted', 'expired'], true) ? $reason : 'closed';

        return DB::transaction(function () use ($pin, $reason) {
            $call = SosCall::where('pin_id', $pin->id)->lockForUpdate()->first();

            if (! $call || ! $call->conversation_id) {
                if ($call && $call->status !== SosCall::STATUS_CLOSED) {
                    $call->forceFill(['status' => SosCall::STATUS_CLOSED])->save();
                }

                return $call ? (int) $call->conversation_id : null;
            }

            $conversation = Conversation::find($call->conversation_id);

            if (! $conversation) {
                $call->forceFill(['status' => SosCall::STATUS_CLOSED])->save();

                return null;
            }

            $participantIds = $conversation->participantRows()->pluck('user_id')->map(fn ($id) => (int) $id)->unique()->values()->all();

            if (empty($participantIds)) {
                $call->forceFill(['status' => SosCall::STATUS_CLOSED])->save();

                return (int) $conversation->id;
            }

            $alreadyHidden = (int) $conversation->participantRows()->whereNotNull('hidden_at')->count();
            $isAlreadyClosed = $call->status === SosCall::STATUS_CLOSED && $alreadyHidden >= count($participantIds);

            if ($isAlreadyClosed) {
                return (int) $conversation->id;
            }

            $messages = Message::where('conversation_id', $conversation->id)
                ->with('sender:id,name')
                ->orderBy('id')
                ->limit(2000)
                ->get();

            $usersById = User::whereIn('id', $participantIds)->get(['id', 'name', 'avatar_path'])->keyBy('id');

            $pinTitle = (string) ($pin->title ?? 'SOS');

            $archivePaths = [];
            $now = now();

            foreach ($participantIds as $uid) {
                $content = self::renderHistoryFile($pinTitle, $reason, $messages, $usersById, $now);
                $base = 'sos-chat-'.$conversation->id.'-user-'.$uid.'-'.now()->format('Ymd-His').'.txt';
                $path = 'chat-archives/'.$base;

                try {
                    Storage::disk(ChatAttachment::disk())->put($path, $content);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('sos archive write failed: '.$e->getMessage());

                    continue;
                }

                $size = 0;

                try {
                    $size = (int) Storage::disk(ChatAttachment::disk())->size($path);
                } catch (\Throwable) {
                    $size = strlen($content);
                }

                $fileName = 'SOS-чат · '.$pinTitle.'.txt';

                try {
                    Message::create([
                        'conversation_id' => $conversation->id,
                        'sender_id' => $uid,
                        'body' => '📦 История SOS-чата сохранена в архив.',
                        'type' => 'file',
                        'attachment_path' => $path,
                        'attachment_name' => $fileName,
                        'attachment_mime' => 'text/plain',
                        'attachment_size' => $size,
                        'attachment_kind' => 'file',
                    ]);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('sos archive message failed: '.$e->getMessage());
                }

                $archivePaths[$uid] = $path;
            }

            $conversation->participantRows()->update(['hidden_at' => $now, 'cleared_at' => $now]);
            $call->forceFill(['status' => SosCall::STATUS_CLOSED])->save();

            foreach ($participantIds as $uid) {
                $user = $usersById->get($uid) ?? User::find($uid);

                if (! $user) {
                    continue;
                }

                $path = $archivePaths[$uid] ?? null;

                try {
                    UserNotifier::send($user, new SosChatClosedNotification(
                        (int) $conversation->id,
                        $reason,
                        $pinTitle,
                        $path ? ChatAttachment::url($path) : null,
                        $path ? 'SOS-чат · '.$pinTitle.'.txt' : null,
                    ));
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('sos closed notify failed: '.$e->getMessage());
                }
            }

            return (int) $conversation->id;
        });
    }

    /**
     * Текст истории SOS-чата для архивного файла.
     *
     * @param string $pinTitle заголовок пина
     * @param string $reason причина закрытия
     * @param \Illuminate\Support\Collection<int, Message> $messages сообщения
     * @param \Illuminate\Support\Collection<int, User> $usersById участники
     * @param \Carbon\Carbon $now момент выгрузки
     * @return string содержимое .txt
     */
    private static function renderHistoryFile(string $pinTitle, string $reason, $messages, $usersById, $now): string
    {
        $reasonLabel = match ($reason) {
            'deleted' => 'пин удалён',
            'expired' => 'истёк срок пина',
            default => 'пин завершён',
        };

        $names = $usersById->map(fn ($u) => (string) ($u->name ?? ('user '.$u->id)))->values()->all();

        $lines = [];
        $lines[] = 'SOS-чат · '.$pinTitle;
        $lines[] = 'Завершён: '.$reasonLabel.' · '.$now->toDateTimeString();
        $lines[] = 'Участники: '.implode(', ', $names);
        $lines[] = str_repeat('—', 32);

        foreach ($messages as $message) {
            $senderName = $message->relationLoaded('sender') && $message->sender
                ? (string) $message->sender->name
                : (string) ($usersById->get($message->sender_id)?->name ?? ('user '.$message->sender_id));

            $when = '';

            try {
                $when = $message->created_at ? Carbon::parse($message->created_at)->format('d.m.Y H:i') : '';
            } catch (\Throwable) {
                $when = '';
            }

            $body = trim((string) ($message->body ?? ''));

            if ($body === '' && $message->attachment_name) {
                $body = '[файл] '.$message->attachment_name;
            }

            $prefix = $when !== '' ? '['.$when.'] ' : '';
            $lines[] = $prefix.$senderName.': '.$body;
        }

        if ($messages->isEmpty()) {
            $lines[] = '(сообщений не было)';
        }

        $lines[] = str_repeat('—', 32);
        $lines[] = 'История сохранена автоматически при завершении SOS.';

        return implode("\n", $lines);
    }
}
