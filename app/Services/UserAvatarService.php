<?php

namespace App\Services;

use App\Models\ProfilePhoto;
use App\Models\User;

/**
 * Фолбэк аватара на первое фото галереи профиля.
 *
 * Рассинхрон: avatar_path пуст (legacy-аккаунт, удалённое фото, вход через
 * Telegram без фото), а в profile_photos фото есть — чат показывал
 * заглушку-человечка, хотя в профиле фото видны. Чинится в двух местах:
 * - на чтение: attachGalleryFallback() подменяет avatar_path в памяти первым
 *   фото галереи (один запрос на всех пользователей), аксессор avatar_url
 *   дальше работает сам, в БД ничего не пишется;
 * - навсегда: backfillEmptyAvatars() прописывает avatar_path в БД
 *   (команда avatars:backfill-gallery, идемпотентна).
 *
 * Цепочка итога везде одна: аватарка → первое фото галереи → заглушка.
 */
class UserAvatarService
{
    /**
     * Подменить пустой аватар первым фото галереи (только в памяти).
     *
     * Трогает лишь модели без avatar_path и без telegram-фото. Первое фото —
     * по (sort_order, id), т.е. то же главное, что профиль показывает первым.
     * Модели мутятся in-place: последующий доступ к avatar_url отдаёт URL
     * фото галереи без единого дополнительного запроса на пользователя.
     *
     * @param iterable<int, User> $users модели пользователей (мутятся in-place)
     * @return void
     */
    public static function attachGalleryFallback(iterable $users): void
    {
        $needles = [];

        foreach ($users as $user) {
            if (! $user instanceof User) {
                continue;
            }

            $hasAvatar = trim((string) ($user->avatar_path ?? '')) !== '';
            $hasTelegram = trim((string) ($user->telegram_photo_url ?? '')) !== '';

            if ($hasAvatar || $hasTelegram) {
                continue;
            }

            $needles[(int) $user->id] = $user;
        }

        if ($needles === []) {
            return;
        }

        $rows = ProfilePhoto::whereIn('user_id', array_keys($needles))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['user_id', 'path']);

        $done = [];

        foreach ($rows as $row) {
            $userId = (int) $row->user_id;

            if (isset($done[$userId])) {
                continue;
            }

            $done[$userId] = true;

            $path = trim((string) ($row->path ?? ''));

            if ($path === '') {
                continue;
            }

            $needles[$userId]->avatar_path = $path;
        }
    }

    /**
     * Навсегда прописать avatar_path первым фото галереи тем, у кого аватара нет.
     *
     * Идемпотентно: трогает только avatar_path IS NULL + пустое telegram-фото.
     * Пользователи совсем без фото не затрагиваются — им положена заглушка.
     *
     * @param int $chunk размер чанка перебора пользователей
     * @param bool $dryRun только посчитать без записи
     * @return int сколько пользователей починено (в dry-run — было бы починено)
     */
    public static function backfillEmptyAvatars(int $chunk = 200, bool $dryRun = false): int
    {
        $chunk = max(50, $chunk);
        $fixed = 0;

        User::whereNull('avatar_path')
            ->where(function ($query): void {
                $query->whereNull('telegram_photo_url');
                $query->orWhere('telegram_photo_url', '');
            })
            ->chunkById($chunk, function ($users) use (&$fixed, $dryRun): void {
                $ids = $users->pluck('id')->all();

                $rows = ProfilePhoto::whereIn('user_id', $ids)
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get(['user_id', 'path']);

                $firstPaths = [];

                foreach ($rows as $row) {
                    $userId = (int) $row->user_id;

                    if (isset($firstPaths[$userId])) {
                        continue;
                    }

                    $path = trim((string) ($row->path ?? ''));

                    if ($path === '') {
                        continue;
                    }

                    $firstPaths[$userId] = $path;
                }

                foreach ($users as $user) {
                    $path = $firstPaths[(int) $user->id] ?? null;

                    if ($path === null) {
                        continue;
                    }

                    $fixed++;

                    if (! $dryRun) {
                        $user->forceFill(['avatar_path' => $path])->saveQuietly();
                    }
                }
            });

        return $fixed;
    }
}
