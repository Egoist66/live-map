<?php

namespace App\Services;

use App\Models\AppUpdate;
use App\Notifications\AppPublishedNotification;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Системная новость-гид по разделам приложения.
 *
 * Пока выпущен только ULove — новость рассказывает о знакомствах:
 * свайпы, мэтчи, чат и где что настраивается. По мере выпуска
 * разделов текст обновляется новой версией (VERSION): старая
 * запись при этом снимается с публикации, чтобы в «Новостях»
 * не висели упоминания невыпущенного.
 *
 * Новость лежит в колокольчике (таб «Новости» + модалка «Что нового»)
 * и подсказывает, где включается остальное: Настройки → Приложение
 * → «Разделы приложения».
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
    public const VERSION = 'modules-guide-v2';

    /**
     * Заголовок новости в колокольчике.
     */
    public const TITLE = 'ULove: короткий гид по знакомствам';

    /**
     * Текст новости: как устроены знакомства и где что включается.
     */
    public const BODY = "ULove — это знакомства рядом. Листай анкеты людей поблизости, ставь лайк или пас, а взаимный лайк открывает мэтч и чат.\n\n"
        . "Как всё устроено:\n"
        . "1. Свайпы — листай ленту и отмечай, кто понравился.\n"
        . "2. Мэтч — взаимный лайк открывает direct-чат.\n"
        . "3. Суперлайк (синяя звезда) — выдели анкету, тебя заметят первым.\n\n"
        . "Где что настраивается:\n"
        . "1. Открой Настройки → Приложение → «Разделы приложения».\n"
        . "2. Звезда ★ — какой раздел открывать после входа.\n\n"
        . "Ничего переустанавливать не нужно. Новые функции всегда ищи в колокольчике → таб «Новости».";

    /**
     * Найти или создать опубликованную новость-гид.
     *
     * Старые версии гида снимаем с публикации: в «Новостях» должна
     * лежать только актуальная, без упоминаний невыпущенных разделов.
     *
     * @return AppUpdate опубликованная запись гида
     */
    public static function ensurePublished(): AppUpdate
    {
        AppUpdate::where('version', 'like', 'modules-guide-%')
            ->where('version', '!=', self::VERSION)
            ->where('is_published', true)
            ->update(['is_published' => false]);

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
