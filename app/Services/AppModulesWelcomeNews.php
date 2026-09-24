<?php

namespace App\Services;

use App\Models\AppUpdate;
use App\Notifications\AppPublishedNotification;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Системная новость-гид по разделам приложения.
 *
 * Новичок после регистрации видит только выбранный на лендинге
 * модуль (ULove ИЛИ карта ИЛИ бизнес) и может не знать, что рядом
 * есть другие разделы. Эта новость лежит в колокольчике (таб
 * «Новости» + модалка «Что нового») и подсказывает, где включить
 * остальное: Настройки → Приложение → «Разделы приложения».
 *
 * Выдача идемпотентна: у кого новость уже есть (прочитана или нет) —
 * ничего не досылаем; у кого её ни разу не было — создаём через
 * UserNotifier (dedupeKey app:{id} защищает от дублей).
 */
class AppModulesWelcomeNews
{
    /**
     * Маркер версии гида: по нему находим запись без миграций.
     */
    public const VERSION = 'modules-guide-v1';

    /**
     * Заголовок новости в колокольчике.
     */
    public const TITLE = 'Это не только один раздел — есть и другие';

    /**
     * Текст новости: что есть в приложении и где включается.
     */
    public const BODY = "Ты сейчас в одном разделе — например, в знакомствах или на карте. Но приложение — это пять разделов в одном:\n\n"
        . "❤️ ULove — знакомства рядом: свайпы, мэтчи, чаты\n"
        . "📍 UPin-карта — пины соседей, события и помощь рядом\n"
        . "📰 UFlow — лента постов и обсуждений\n"
        . "🏘️ Районы — сообщества твоего района и их новости\n"
        . "💼 Бизнес — кабинет компании и клиенты с карты\n\n"
        . "Как включить другие разделы:\n"
        . "1. Открой Настройки → Приложение → «Разделы приложения».\n"
        . "2. Включи нужное тумблером — раздел докачается и заработает сразу.\n"
        . "3. Звезда ★ — какой раздел открывать после входа.\n\n"
        . "Ничего переустанавливать не нужно. Новые функции всегда ищи в колокольчике → таб «Новости».";

    /**
     * Найти или создать опубликованную новость-гид.
     *
     * @return AppUpdate опубликованная запись гида
     */
    public static function ensurePublished(): AppUpdate
    {
        $existing = AppUpdate::where('version', self::VERSION)
            ->where('is_published', true)
            ->latest('id')
            ->first();

        if ($existing) {
            return $existing;
        }

        return AppUpdate::create([
            'title' => self::TITLE,
            'body' => self::BODY,
            'version' => self::VERSION,
            'is_published' => true,
            'published_at' => now(),
            'created_by' => null,
        ]);
    }

    /**
     * Выдать новость пользователю, если у него её ни разу не было.
     *
     * Проверяем по key = app:{id} (и по data->update_id для старых строк):
     * есть хоть одна строка — прочитана или нет — выходим молча.
     * Админам не шлём: они новости публикуют, а не читают.
     *
     * @param \App\Models\User $user получатель
     * @return void
     */
    public static function ensureDelivered($user): void
    {
        try {
            if (! $user || ! $user->getKey()) {
                return;
            }

            if (! empty($user->is_admin) || ($user->role ?? null) === 'admin') {
                return;
            }

            $update = self::ensurePublished();

            $morph = $user->getMorphClass();
            $userId = $user->getKey();
            $key = 'app:'.$update->id;

            $hasByKey = DatabaseNotification::where('notifiable_type', $morph)
                ->where('notifiable_id', $userId)
                ->where('type', 'app.published')
                ->where('key', $key)
                ->exists();

            if ($hasByKey) {
                return;
            }

            $hasLegacy = DatabaseNotification::where('notifiable_type', $morph)
                ->where('notifiable_id', $userId)
                ->where('type', 'app.published')
                ->where('data->update_id', $update->id)
                ->exists();

            if ($hasLegacy) {
                return;
            }

            UserNotifier::send($user, new AppPublishedNotification($update));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('modules welcome news failed', [
                'user_id' => $user->getKey() ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
