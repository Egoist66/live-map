<?php

namespace App\Services;

use App\Models\User;

/**
 * Репутация пользователя: траст-скор 1–10.
 *
 * Не путать с очками активности (ReputationService: ранги Новичок…Гид
 * за задания и активность — та система скрыта, пока дефолт ULove).
 * Траст падает от событий: жалоба на пользователя (−1), блокировка
 * его кем-то (−1), низкая оценка в отзыве 1–2 (−1). Отклонённая
 * модератором жалоба возвращает +1. Покупка/выдача PRO или Premium
 * сразу ставит идеальные 10 — но дальше скор снова может портиться.
 *
 * Хранится в users.trust_score, всегда в коридоре 1–10.
 */
class TrustScoreService
{
    /** Минимум шкалы. */
    public const MIN = 1;

    /** Максимум и стартовое значение шкалы. */
    public const MAX = 10;

    /**
     * Зоны шкалы: коридор => подпись и короткая расшифровка.
     *
     * @var array<int, array{min:int, max:int, label:string, hint:string}>
     */
    public const ZONES = [
        ['min' => 1, 'max' => 2, 'label' => 'Плохо', 'hint' => 'много жалоб и блокировок — такому профилю не доверяют'],
        ['min' => 3, 'max' => 4, 'label' => 'Подозрительный', 'hint' => 'были жалобы — присмотрись, могут быть нюансы'],
        ['min' => 5, 'max' => 6, 'label' => 'Спорно', 'hint' => 'обычный профиль с парой шероховатостей'],
        ['min' => 7, 'max' => 8, 'label' => 'Хорошо', 'hint' => 'адекватный пользователь, мелочи в прошлом'],
        ['min' => 9, 'max' => 10, 'label' => 'Отлично', 'hint' => 'чистая репутация без нареканий'],
    ];

    /**
     * Текущий скор пользователя в коридоре 1–10.
     *
     * @param User $user чей скор
     * @return int 1–10
     */
    public static function scoreOf(User $user): int
    {
        $raw = (int) ($user->trust_score ?? self::MAX);

        return max(self::MIN, min(self::MAX, $raw));
    }

    /**
     * Зона шкалы для значения: подпись и расшифровка.
     *
     * @param int $score 1–10
     * @return array{label:string, hint:string}
     */
    public static function zoneFor(int $score): array
    {
        $score = max(self::MIN, min(self::MAX, $score));

        foreach (self::ZONES as $zone) {
            if ($score >= $zone['min'] && $score <= $zone['max']) {
                return ['label' => $zone['label'], 'hint' => $zone['hint']];
            }
        }

        return ['label' => 'Спорно', 'hint' => 'обычный профиль'];
    }

    /**
     * Сдвинуть скор на дельту в коридоре 1–10 и сохранить.
     *
     * @param User $user чей скор
     * @param int $delta сдвиг (отрицательный роняет)
     * @return int новый скор
     */
    public static function adjust(User $user, int $delta): int
    {
        $next = max(self::MIN, min(self::MAX, self::scoreOf($user) + $delta));
        $user->forceFill(['trust_score' => $next])->save();

        return $next;
    }

    /**
     * Жалоба на пользователя: −1 к репутации.
     *
     * @param User $target на кого пожаловались
     * @return int новый скор
     */
    public static function penalizeReport(User $target): int
    {
        return self::adjust($target, -1);
    }

    /**
     * Жалобу отклонили: вернуть −1 обратно.
     *
     * @param User $target кого зря обвинили
     * @return int новый скор
     */
    public static function restoreReport(User $target): int
    {
        return self::adjust($target, 1);
    }

    /**
     * Пользователя заблокировали: −1 к репутации.
     *
     * @param User $target кого заблокировали
     * @return int новый скор
     */
    public static function penalizeBlock(User $target): int
    {
        return self::adjust($target, -1);
    }

    /**
     * Низкая оценка в отзыве (1–2): −1 к репутации.
     *
     * @param User $target кого низко оценили
     * @return int новый скор
     */
    public static function penalizeBadReview(User $target): int
    {
        return self::adjust($target, -1);
    }

    /**
     * Выдача PRO/Premium: репутация сразу идеальная (10).
     *
     * Дальше скор снова может портиться от жалоб, блоков и оценок.
     *
     * @param User $user кому выдали тариф
     * @return int всегда 10
     */
    public static function restoreOnPaidPlan(User $user): int
    {
        $user->forceFill(['trust_score' => self::MAX])->save();

        return self::MAX;
    }

    /**
     * Состояние для API: скор и его зона.
     *
     * @param User $user чей скор
     * @return array{score:int, label:string, hint:string}
     */
    public static function state(User $user): array
    {
        $score = self::scoreOf($user);

        return ['score' => $score] + self::zoneFor($score);
    }
}
