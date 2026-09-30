<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Отложенное удаление профиля с приманкой возврата.
 *
 * Механика «нам будет плохо без вас»:
 * - по запросу прячем анкету (никто не видит), ставим
 *   deletion_requested_at/scheduled_at = +14 дней;
 * - дарим неделю PRO: plan=pro, plan_expires_at=+7 дней,
 *   deletion_pro_until=+7 дней (для красивых текстов);
 * - в течение 14 дней пользователь может вернуться одним тапом —
 *   все данные на месте (мы ничего не трём до дедлайна);
 * - после дедлайна команда users:prune-pending-deletion трёт всё
 *   через UserDeletionService (БД + файлы) без возможности возврата.
 */
class AccountDeletionService
{
    /**
     * Grace-период до необратимого удаления, дней.
     */
    public const GRACE_DAYS = 14;

    /**
     * Прощальная неделя PRO, дней.
     */
    public const FAREWELL_PRO_DAYS = 7;

    /**
     * Запросить удаление: спрятать + запланировать + подарить PRO.
     *
     * @param User $user владелец профиля
     * @return User свежая модель
     */
    public static function request(User $user): User
    {
        $now = now();

        $proUntil = $now->copy()->addDays(self::FAREWELL_PRO_DAYS);
        $scheduled = $now->copy()->addDays(self::GRACE_DAYS);

        $currentExpiry = $user->plan_expires_at;

        try {
            $currentExpiryTime = $currentExpiry ? $currentExpiry->copy() : null;
        } catch (\Throwable) {
            $currentExpiryTime = null;
        }

        $planExpiresAt = $proUntil;

        if ($currentExpiryTime !== null && $currentExpiryTime->greaterThan($proUntil)) {
            $planExpiresAt = $currentExpiryTime;
        }

        $isPaid = in_array($user->effectivePlan(), User::PAID_PLANS, true);

        $patch = [
            'profile_hidden_at' => $now,
            'is_hidden_from_search' => true,
            'dating_enabled' => false,
            'deletion_requested_at' => $now,
            'deletion_scheduled_at' => $scheduled,
            'deletion_pro_until' => $proUntil,
        ];

        if (! $isPaid) {
            $patch['plan'] = 'pro';
            $patch['plan_expires_at'] = $planExpiresAt;
        }

        $user->forceFill($patch)->save();

        return $user->fresh() ?? $user;
    }

    /**
     * Отменить удаление: вернуть видимость, снять расписание.
     *
     * Данные не трогались — просто снимаем флаги. Подаренный PRO
     * остаётся до plan_expires_at (пусть пользуется, ему понравится).
     *
     * @param User $user владелец профиля
     * @return User свежая модель
     */
    public static function cancel(User $user): User
    {
        $user->forceFill([
            'profile_hidden_at' => null,
            'is_hidden_from_search' => false,
            'dating_enabled' => true,
            'deletion_requested_at' => null,
            'deletion_scheduled_at' => null,
        ])->save();

        return $user->fresh() ?? $user;
    }

    /**
     * Пользователи, чей grace истёк и пора тереть всё.
     *
     * @param int $limit максимум за проход
     * @return array<int> id пользователей
     */
    public static function dueIds(int $limit = 100): array
    {
        $rows = User::whereNotNull('deletion_requested_at')
            ->whereNotNull('deletion_scheduled_at')
            ->where('deletion_scheduled_at', '<=', now())
            ->orderBy('deletion_scheduled_at')
            ->limit(max(1, $limit))
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        return $rows;
    }

    /**
     * Необратимо удалить всех просроченных (для cron).
     *
     * @param UserDeletionService $deletion сервис полного удаления
     * @param int $limit максимум за проход
     * @return int сколько реально удалено
     */
    public static function pruneDue(UserDeletionService $deletion, int $limit = 100): int
    {
        $ids = self::dueIds($limit);

        if ($ids === []) {
            return 0;
        }

        $removed = 0;

        foreach ($ids as $id) {
            $user = User::find($id);

            if ($user === null) {
                continue;
            }

            if ($user->deletion_scheduled_at === null) {
                continue;
            }

            $isDue = false;

            try {
                $isDue = $user->deletion_scheduled_at->isPast();
            } catch (\Throwable) {
                $isDue = false;
            }

            if (! $isDue) {
                continue;
            }

            try {
                DB::transaction(function () use ($deletion, $user): void {
                    $deletion->delete($user);
                });

                $removed++;
            } catch (\Throwable) {
                continue;
            }
        }

        return $removed;
    }
}
