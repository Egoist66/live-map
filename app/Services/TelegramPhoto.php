<?php

namespace App\Services;

use App\Models\User;

/**
 * Фото для карточек Telegram-бота.
 *
 * Bot API принимает только абсолютный https-URL (sendPhoto). Аватар из
 * Telegram — уже https, а локальные файлы (public-диск) отдают
 * относительный путь (/storage/...) — его добиваем до APP_URL, но лишь
 * когда APP_URL сам https, иначе фото не уйдёт и шлём текст без фото.
 */
class TelegramPhoto
{
    /**
     * Добить URL до абсолютного https либо отбросить.
     *
     * @param string|null $url сырой URL (аватар, фото галереи)
     * @return string|null https-URL либо null когда послать нельзя
     */
    public static function absolutize(?string $url): ?string
    {
        $clean = trim((string) ($url ?? ''));

        if ($clean === '') {
            return null;
        }

        if (str_starts_with($clean, 'https://')) {
            return mb_substr($clean, 0, 512);
        }

        if (! str_starts_with($clean, '/')) {
            return null;
        }

        $base = rtrim((string) config('app.url', ''), '/');

        if (! str_starts_with($base, 'https://')) {
            return null;
        }

        return mb_substr($base.$clean, 0, 512);
    }

    /**
     * Лучшее фото пользователя для карточки бота.
     *
     * Порядок: аватар (или TG-аватар) → первое фото галереи.
     * Лишних запросов нет: галерею дёргаем только когда аватара нет.
     *
     * @param User $user чьё фото
     * @return string|null https-URL либо null когда показать нечего
     */
    public static function bestFor(User $user): ?string
    {
        $avatar = self::absolutize($user->avatar_url);

        if ($avatar !== null) {
            return $avatar;
        }

        try {
            $first = $user->profilePhotos()->orderBy('sort_order')->first();
        } catch (\Throwable) {
            return null;
        }

        if ($first === null) {
            return null;
        }

        return self::absolutize($first->url ?? null);
    }
}
