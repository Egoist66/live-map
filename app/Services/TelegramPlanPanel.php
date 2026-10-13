<?php

namespace App\Services;

use App\Http\Controllers\SubscriptionController;
use App\Models\User;

/**
 * Панель «Мой тариф» для Telegram-бота.
 *
 * Показывает действующий тариф, срок и остаток дней + список
 * для выбора. Платные тарифы нельзя просто взять кнопкой —
 * сначала оплата (перевод на карту/счёт), поэтому выбор PRO/Premium
 * показывает заглушку «Оплата в разработке», а мгновенно
 * переключается только откат на Free.
 */
class TelegramPlanPanel
{
    /**
     * Текст-заглушка оплаты платных тарифов.
     */
    public const PAYMENT_NOTE = '💳 Оплата в разработке: тарифы PRO/Premium подключаются после оплаты переводом на карту или счёт. Напишите в поддержку — после подтверждения оплаты тариф включат вручную.';

    /**
     * Собрать карточку текущего тарифа.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $plan = (string) ($fresh->effectivePlan() ?? 'free');
        $label = TelegramInsights::planLabel($plan);

        $expiresRaw = $fresh->plan_expires_at;
        $expiresLabel = null;
        $daysLeft = null;

        try {
            if ($expiresRaw) {
                $expires = \Carbon\Carbon::parse($expiresRaw);
                $expiresLabel = $expires->format('d.m.Y');
                $daysLeft = (int) ceil(($expires->timestamp - now()->timestamp) / 86400);
            }
        } catch (\Throwable) {
            $expiresLabel = null;
        }

        $lines = [];
        $lines[] = '💎 <b>Мой тарифный план: '.$label.'</b>';
        $lines[] = '';

        if ($plan === 'free') {
            $lines[] = 'Вы на бесплатном тарифе: свайпы рядом до 10 км, 3 сообщения без мэтча в месяц, избранное до 3 анкет.';
        } else {
            $detail = 'Действует';

            if ($expiresLabel !== null) {
                $detail .= ' до <b>'.$expiresLabel.'</b>';
            }

            if ($daysLeft !== null) {
                $detail .= ' (осталось '.$daysLeft.' дн.)';
            }

            $lines[] = $detail.'.';
        }

        $lines[] = '';
        $lines[] = 'Free — бесплатно навсегда. PRO/Premium — после оплаты (пока в разработке, кнопкой не включаются).';

        $keyboard = [
            [
                ['text' => '💎 Выбрать тариф', 'callback_data' => 'go_plan_list'],
            ],
            [
                ['text' => '👤 Мой профиль', 'callback_data' => 'go_profile'],
                ['text' => '🔄 Обновить', 'callback_data' => 'go_plan'],
            ],
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Собрать список тарифов для выбора.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function list(User $user): array
    {
        $fresh = $user->fresh() ?? $user;
        $current = (string) ($fresh->effectivePlan() ?? 'free');

        $isOrganization = (string) ($fresh->role ?? '') === 'organization'
            || (string) ($fresh->account_type ?? 'person') === 'business';

        $lines = [];
        $lines[] = '💎 <b>Выбор тарифного плана</b>';
        $lines[] = '';
        $lines[] = '• Free — бесплатно навсегда (свайпы, мэтчи, 3 сообщения/мес).';
        $lines[] = '• PRO — '.PlanCatalog::priceLabel('pro').': инкогнито, хайды, безлимит радиуса, 20 сообщений/мес, репутация сразу 10.';
        $lines[] = '• Premium — '.PlanCatalog::priceLabel('premium').': максимум из PRO + безлимитный сброс, избранное до 15, репутация сразу 10.';

        if ($isOrganization) {
            $lines[] = '• Business — '.PlanCatalog::priceLabel('business').': только для организаций, кабинет компании.';
        }

        $lines[] = '';
        $lines[] = self::PAYMENT_NOTE;

        $keyboard = [];
        $keyboard[] = [
            ['text' => self::chooseLabel('Free', $current === 'free'), 'callback_data' => 'plan_free'],
        ];
        $keyboard[] = [
            ['text' => self::chooseLabel('PRO · '.PlanCatalog::priceLabel('pro'), $current === 'pro'), 'callback_data' => 'plan_pro'],
            ['text' => self::chooseLabel('Premium · '.PlanCatalog::priceLabel('premium'), $current === 'premium'), 'callback_data' => 'plan_premium'],
        ];

        if ($isOrganization) {
            $keyboard[] = [
                ['text' => self::chooseLabel('Business · '.PlanCatalog::priceLabel('business'), $current === 'business'), 'callback_data' => 'plan_business'],
            ];
        }

        $keyboard[] = [
            ['text' => '◀️ Мой тариф', 'callback_data' => 'go_plan'],
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Подпись кнопки выбора тарифа.
     *
     * @param string $label название тарифа
     * @param bool $isCurrent текущий ли
     * @return string
     */
    private static function chooseLabel(string $label, bool $isCurrent): string
    {
        return $isCurrent ? '✓ '.$label : $label;
    }

    /**
     * Сколько дней длится платный период (зеркало SubscriptionController).
     *
     * @return int
     */
    public static function periodDays(): int
    {
        return SubscriptionController::PERIOD_DAYS;
    }
}
