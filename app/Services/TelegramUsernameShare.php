<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\TelegramShareOffer;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Обмен Telegram-username по обоюдному согласию.
 *
 * Сценарий: в direct-диалоге каждый жмёт «Поделиться Telegram».
 * Как только офферы есть с обеих сторон — каждому в личку бота
 * прилетает @username собеседника с кнопками «Написать в Telegram»
 * и «Открыть чат». До момента взаимности юзернеймы не светим
 * никому: ни в API (peer_username только после exchanged),
 * ни в боте.
 */
class TelegramUsernameShare
{
    /**
     * Статус обмена для смотрящего.
     *
     * @param Conversation $conversation диалог
     * @param User $me смотрящий
     * @return array{mine:bool, peer:bool, exchanged:bool, peer_username:string|null}
     */
    public static function status(Conversation $conversation, User $me): array
    {
        $empty = ['mine' => false, 'peer' => false, 'exchanged' => false, 'peer_username' => null];

        if ($conversation->type !== 'direct') {
            return $empty;
        }

        $offers = TelegramShareOffer::where('conversation_id', $conversation->id)->get();

        $mine = $offers->firstWhere('user_id', (int) $me->id);
        $peerOffer = $offers->first(fn ($offer) => (int) $offer->user_id !== (int) $me->id);

        if (! $mine) {
            return $empty;
        }

        $exchanged = $mine->exchanged_at !== null && $peerOffer && $peerOffer->exchanged_at !== null;

        return [
            'mine' => true,
            'peer' => $peerOffer !== null,
            'exchanged' => $exchanged,
            'peer_username' => $exchanged ? self::peerUsername($conversation, $me) : null,
        ];
    }

    /**
     * Создать/подтвердить намерение поделиться.
     *
     * Второй оффер триггерит обмен: если у обоих есть @username —
     * рассылаем, иначе возвращаем ошибку no_username (офферы
     * сохраняются, можно повторить после установки username в TG).
     *
     * @param Conversation $conversation direct-диалог
     * @param User $me автор оффера
     * @return array{mine:bool, peer:bool, exchanged:bool, peer_username:string|null, error:string|null}
     *
     * @throws HttpException 403 чужой диалог, 422 не-direct или уже обменян
     */
    public static function offer(Conversation $conversation, User $me): array
    {
        self::assertDirectParticipant($conversation, $me);

        $mine = TelegramShareOffer::firstOrCreate([
            'conversation_id' => $conversation->id,
            'user_id' => $me->id,
        ]);

        if ($mine->exchanged_at !== null) {
            abort(422, 'Обмен уже состоялся.');
        }

        $exchangeError = self::maybeExchange($conversation, $me);

        return array_merge(self::status($conversation, $me), ['error' => $exchangeError]);
    }

    /**
     * Отозвать намерение (до момента обмена).
     *
     * После состоявшегося обмена отзывать нечего — username уже
     * у собеседника, честно отвечаем already_exchanged.
     *
     * @param Conversation $conversation direct-диалог
     * @param User $me автор оффера
     * @return array{mine:bool, peer:bool, exchanged:bool, peer_username:string|null, error:string|null}
     *
     * @throws HttpException 403 чужой диалог, 422 не-direct
     */
    public static function revoke(Conversation $conversation, User $me): array
    {
        self::assertDirectParticipant($conversation, $me);

        $mine = TelegramShareOffer::where('conversation_id', $conversation->id)
            ->where('user_id', $me->id)
            ->first();

        if ($mine && $mine->exchanged_at !== null) {
            abort(422, 'Обмен уже состоялся — username уже у собеседника.');
        }

        if ($mine) {
            $mine->delete();
        }

        return array_merge(self::status($conversation, $me), ['error' => null]);
    }

    /**
     * Попробовать завершить обмен, если согласны оба.
     *
     * @param Conversation $conversation direct-диалог
     * @param User $me только что оффернувший
     * @return string|null код ошибки (no_username) или null при успехе/ожидании
     */
    private static function maybeExchange(Conversation $conversation, User $me): ?string
    {
        $peerId = (int) $conversation->participantRows()
            ->where('user_id', '!=', $me->id)
            ->value('user_id');

        if ($peerId <= 0) {
            return null;
        }

        $peerOffer = TelegramShareOffer::where('conversation_id', $conversation->id)
            ->where('user_id', $peerId)
            ->first();

        if (! $peerOffer || $peerOffer->exchanged_at !== null) {
            return null;
        }

        $meFresh = User::find($me->id);
        $peer = User::find($peerId);

        if (! $meFresh || ! $peer) {
            return null;
        }

        $myUsername = self::cleanUsername($meFresh?->telegram_username);
        $peerUsername = self::cleanUsername($peer?->telegram_username);

        if ($myUsername === '' || $peerUsername === '') {
            return 'no_username';
        }

        DB::transaction(function () use ($conversation, $me, $peerId) {
            TelegramShareOffer::where('conversation_id', $conversation->id)
                ->whereIn('user_id', [(int) $me->id, $peerId])
                ->whereNull('exchanged_at')
                ->update(['exchanged_at' => now()]);
        });

        $meName = trim((string) ($meFresh?->name ?? ''));
        $peerName = trim((string) ($peer?->name ?? ''));

        TelegramNotifier::usernameExchanged($meFresh, $peerUsername, $peerName, (int) $conversation->id);
        TelegramNotifier::usernameExchanged($peer, $myUsername, $meName, (int) $conversation->id);

        return null;
    }

    /**
     * Username собеседника после состоявшегося обмена.
     *
     * @param Conversation $conversation direct-диалог
     * @param User $me смотрящий
     * @return string|null username без @ или null
     */
    private static function peerUsername(Conversation $conversation, User $me): ?string
    {
        $peerId = (int) $conversation->participantRows()
            ->where('user_id', '!=', $me->id)
            ->value('user_id');

        if ($peerId <= 0) {
            return null;
        }

        $username = self::cleanUsername(User::whereKey($peerId)->value('telegram_username'));

        return $username !== '' ? $username : null;
    }

    /**
     * Проверить, что диалог direct и пользователь — участник.
     *
     * @param Conversation $conversation диалог
     * @param User $me пользователь
     * @return void
     *
     * @throws HttpException 403|422
     */
    private static function assertDirectParticipant(Conversation $conversation, User $me): void
    {
        abort_unless($conversation->hasParticipant($me->id), 403, 'Этот чат принадлежит другому аккаунту.');

        abort_if($conversation->type !== 'direct', 422, 'Обмен доступен только в личных диалогах.');
    }

    /**
     * Почистить username: без @, только допустимые символы.
     *
     * @param mixed $raw сырое значение из БД
     * @return string чистый username или пусто
     */
    private static function cleanUsername(mixed $raw): string
    {
        $clean = ltrim(trim((string) ($raw ?? '')), '@');

        if ($clean === '' || ! preg_match('/^[A-Za-z0-9_]{3,64}$/', $clean)) {
            return '';
        }

        return $clean;
    }
}
