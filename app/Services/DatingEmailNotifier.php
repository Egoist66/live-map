<?php

namespace App\Services;

use App\Mail\DatingLikedMail;
use App\Mail\DatingMatchedMail;
use App\Mail\NewMessageMail;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Системные email-напоминания о дейтинг-событиях.
 *
 * Письма уходят только на подтверждённую почту: смысл верификации
 * как раз в том, чтобы было куда слать «тебя лайкнули», «новый мэтч»,
 * «новое сообщение». Антиспам — через кэш-кулдауны на пару/диалог.
 */
class DatingEmailNotifier
{
    /**
     * Кулдаун повторных писем о лайке одной пары, секунд (сутки).
     */
    public const LIKED_COOLDOWN_SECONDS = 86400;

    /**
     * Кулдаун повторных писем о новых сообщениях в диалоге, секунд (час).
     */
    public const MESSAGE_COOLDOWN_SECONDS = 3600;

    /**
     * Можно ли слать письма пользователю.
     *
     * @param User $recipient получатель письма
     * @return bool true когда есть валидный email и он подтверждён
     */
    public static function canNotify(User $recipient): bool
    {
        $email = trim((string) ($recipient->email ?? ''));

        if ($email === '') {
            return false;
        }

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return false;
        }

        return $recipient->hasVerifiedEmail();
    }

    /**
     * Напомнить о новом лайке анкеты.
     *
     * @param User $liker автор лайка
     * @param User $liked получатель
     * @param bool $isIncognito лайк-инкогнито (имя скрываем и в письме)
     * @param bool $isSuperlike усиленный лайк
     * @return void
     */
    public static function liked(User $liker, User $liked, bool $isIncognito = false, bool $isSuperlike = false): void
    {
        if (! self::canNotify($liked)) {
            return;
        }

        $key = "email:liked:{$liker->id}:{$liked->id}";

        if (Cache::has($key)) {
            return;
        }

        Cache::put($key, true, self::LIKED_COOLDOWN_SECONDS);

        try {
            Mail::to($liked->email)->queue(new DatingLikedMail($liker, $liked, $isIncognito, $isSuperlike));
        } catch (\Throwable $e) {
            Log::warning('dating liked email failed: '.$e->getMessage());
        }
    }

    /**
     * Напомнить пассивной стороне о взаимном мэтче.
     *
     * Актор только что свайпнул и видит сплэш мэтча сам —
     * письмо нужно второму человеку.
     *
     * @param User $actor автор свайпа, закрывшего мэтч
     * @param User $other второй участник
     * @param int $matchId id мэтча
     * @return void
     */
    public static function matched(User $actor, User $other, int $matchId): void
    {
        if (! self::canNotify($other)) {
            return;
        }

        try {
            Mail::to($other->email)->queue(new DatingMatchedMail($actor, $other, $matchId));
        } catch (\Throwable $e) {
            Log::warning('dating matched email failed: '.$e->getMessage());
        }
    }

    /**
     * Напомнить о новом сообщении в диалоге.
     *
     * @param User $sender автор сообщения
     * @param User $recipient получатель письма
     * @param Conversation $conversation диалог
     * @param string $preview превью текста (до 200 символов)
     * @return void
     */
    public static function newMessage(User $sender, User $recipient, Conversation $conversation, string $preview): void
    {
        if (! self::canNotify($recipient)) {
            return;
        }

        $key = "email:message:{$conversation->id}:{$recipient->id}";

        if (Cache::has($key)) {
            return;
        }

        Cache::put($key, true, self::MESSAGE_COOLDOWN_SECONDS);

        try {
            Mail::to($recipient->email)->queue(new NewMessageMail($sender, $recipient, $conversation, $preview));
        } catch (\Throwable $e) {
            Log::warning('dating message email failed: '.$e->getMessage());
        }
    }
}
