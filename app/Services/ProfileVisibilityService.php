<?php

namespace App\Services;

use App\Models\User;

/**
 * Видимость анкеты: «скрыть меня ото всех» с возвратом одним тапом.
 *
 * Скрытая анкета:
 * - пропадает из ленты свайпов, поиска людей, карты пинов и чужих профилей
 *   (через User::isDiscoverableBy / hiddenFromSearchFor);
 * - свои данные, чаты, друзья и настройки не трогаем — только видимость;
 * - dating_enabled тоже гасим, чтобы лента DatingService отсекла сразу,
 *   при возврате восстанавливаем dating_enabled=true.
 */
class ProfileVisibilityService
{
    /**
     * Скрыть анкету пользователя.
     *
     * @param User $user владелец анкеты
     * @return User свежая модель
     */
    public static function hide(User $user): User
    {
        $user->forceFill([
            'profile_hidden_at' => now(),
            'is_hidden_from_search' => true,
            'dating_enabled' => false,
        ])->save();

        return $user->fresh() ?? $user;
    }

    /**
     * Вернуть анкету в поиск и ленту.
     *
     * Удаление по grace при этом не отменяем — для него
     * отдельный AccountDeletionService::cancel.
     *
     * @param User $user владелец анкеты
     * @return User свежая модель
     */
    public static function show(User $user): User
    {
        $patch = [
            'profile_hidden_at' => null,
            'dating_enabled' => true,
        ];

        if (! $user->isPendingDeletion()) {
            $patch['is_hidden_from_search'] = false;
        }

        $user->forceFill($patch)->save();

        return $user->fresh() ?? $user;
    }

    /**
     * Переключить видимость одним вызовом (для бота и API).
     *
     * @param User $user владелец анкеты
     * @return array{hidden:bool, user:User}
     */
    public static function toggle(User $user): array
    {
        if ($user->isProfileHidden()) {
            $fresh = self::show($user);

            return ['hidden' => false, 'user' => $fresh];
        }

        $fresh = self::hide($user);

        return ['hidden' => true, 'user' => $fresh];
    }
}
