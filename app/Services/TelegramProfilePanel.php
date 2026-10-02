<?php

namespace App\Services;

use App\Models\User;

/**
 * Карточка «Моя анкета» для Telegram-бота.
 *
 * Показывает имя, тариф, видимость и живые счётчики, а кнопки
 * дают скрыть/вернуть анкету и прыгнуть в Mini App одним тапом.
 */
class TelegramProfilePanel
{
    /**
     * Собрать текст и клавиатуру карточки профиля.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $name = trim((string) ($fresh->name ?? ''));

        if ($name === '') {
            $name = 'Без имени';
        }

        $plan = (string) ($fresh->effectivePlan() ?? 'free');
        $planLabel = TelegramInsights::planLabel($plan);

        $planSuffix = '';

        try {
            if ($fresh->plan_expires_at) {
                $expires = \Carbon\Carbon::parse($fresh->plan_expires_at);
                $daysLeft = (int) ceil(($expires->timestamp - now()->timestamp) / 86400);
                $planSuffix = ' (до '.$expires->format('d.m.Y').', '.$daysLeft.' дн.)';
            }
        } catch (\Throwable) {
            $planSuffix = '';
        }

        $admirers = TelegramInsights::admirers($fresh);
        $matches = TelegramInsights::matches($fresh);
        $unread = TelegramInsights::unreadCount($fresh);

        $lines = [];
        $lines[] = '👤 <b>'.self::esc($name).'</b> · 💎 '.$planLabel.$planSuffix;

        if ($fresh->isPendingDeletion()) {
            $days = $fresh->deletionDaysLeft() ?? 0;
            $lines[] = '⏳ Профиль удаляется через <b>'.$days.' дн.</b> — всё ещё можно вернуться!';
        } elseif ($fresh->isProfileHidden()) {
            $lines[] = '🙈 Анкета <b>скрыта</b> — вас никто не видит. Кайфуйте в тени.';
        } else {
            $lines[] = '👀 Анкета <b>видна</b> — вас находят в ленте и поиске.';
        }

        $lines[] = '';
        $lines[] = '💞 Лайков: <b>'.$admirers['total'].'</b> · 🎉 Мэтчей: <b>'.$matches['total'].'</b> · 💬 Новых: <b>'.$unread.'</b>';

        $email = trim((string) ($fresh->email ?? ''));

        if ($email !== '') {
            $mailMark = $fresh->hasVerifiedEmail() ? '✅' : '⏳';

            if ($fresh->hasTechnicalTelegramEmail()) {
                $mailMark = '⚠️';
            }

            $lines[] = $mailMark.' Почта: <code>'.self::esc($email).'</code>';
        }

        if ($admirers['names'] !== []) {
            $escaped = array_map(fn (string $n): string => self::esc($n), array_slice($admirers['names'], 0, 3));
            $lines[] = 'Последние симпатии: '.implode(', ', $escaped);
        }

        $keyboard = [];

        if ($fresh->isPendingDeletion()) {
            $keyboard[] = [
                ['text' => '💚 Остаться (отменить удаление)', 'callback_data' => 'del_cancel'],
            ];
        } elseif ($fresh->isProfileHidden()) {
            $keyboard[] = [
                ['text' => '👀 Вернуть анкету', 'callback_data' => 'prof_show'],
            ];
        } else {
            $keyboard[] = [
                ['text' => '🙈 Скрыть анкету', 'callback_data' => 'prof_hide'],
            ];
        }

        $keyboard[] = [
            ['text' => '🔥 Найти мэтч здесь', 'callback_data' => 'sw_find'],
            ['text' => '🎉 Мэтчи', 'callback_data' => 'go_matches'],
        ];

        $keyboard[] = [
            ['text' => '💎 Мой тариф', 'callback_data' => 'go_plan'],
            ['text' => '📧 Моя почта', 'callback_data' => 'go_email'],
        ];

        $keyboard[] = [
            ['text' => '💞 Лайки', 'callback_data' => 'go_likes'],
            ['text' => '🔑 Пароль для входа с ПК', 'callback_data' => 'go_password'],
        ];

        $keyboard[] = [
            ['text' => '🔄 Обновить', 'callback_data' => 'prof_refresh'],
            TelegramMenu::openAppButton('🌐 Открыть анкету'),
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Подробная анкета с фото: всё как в приложении, но текстом.
     *
     * Имя, возраст, пол, город, цель, «о себе», интересы, мысль,
     * уровень/репутация, тариф со сроком, видимость, почта, счётчики,
     * число фото и онлайн-статус. Фото отдаём отдельно (photoUrl):
     * отправка — через TelegramCardSender (sendPhoto либо текст).
     *
     * @param User $user чья анкета (обычно своя)
     * @return array{text:string, photoUrl:string|null, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function full(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $name = trim((string) ($fresh->name ?? ''));

        if ($name === '') {
            $name = 'Без имени';
        }

        $title = $name;
        $age = $fresh->age;

        if ($age !== null) {
            $title .= ', '.$age;
        }

        $lines = [];
        $lines[] = '👤 <b>'.self::esc($title).'</b>';

        $meta = [];
        $genderLabel = self::genderLabel((string) ($fresh->gender ?? ''));

        if ($genderLabel !== '') {
            $meta[] = $genderLabel;
        }

        $city = trim((string) ($fresh->home_city ?? ''));

        if ($city !== '') {
            $meta[] = self::esc($city);
        }

        $goalLabel = self::goalLabel((string) ($fresh->dating_goal ?? ''));

        if ($goalLabel !== '') {
            $meta[] = 'цель: '.self::esc($goalLabel);
        }

        if ($meta !== []) {
            $lines[] = implode(' · ', $meta);
        }

        $customGoal = trim((string) ($fresh->dating_custom_goal ?? ''));

        if ($customGoal !== '') {
            $lines[] = '💭 '.self::esc(mb_substr($customGoal, 0, 120));
        }

        $about = trim((string) ($fresh->dating_about ?? ''));

        if ($about !== '') {
            $lines[] = '';
            $lines[] = self::esc(mb_substr($about, 0, 400));
        }

        $interests = $fresh->dating_interests;

        if (is_array($interests) && $interests !== []) {
            $tags = array_slice(array_map('strval', $interests), 0, 8);
            $escaped = array_map(fn (string $tag): string => self::esc($tag), $tags);
            $lines[] = '';
            $lines[] = '🏷 '.implode(', ', $escaped);
        }

        $thought = trim((string) ($fresh->thought ?? ''));

        if ($thought !== '') {
            $lines[] = '💬 «'.self::esc(mb_substr($thought, 0, 140)).'»';
        }

        $level = (int) ($fresh->level ?? 1);
        $reputation = (int) ($fresh->reputation_score ?? 0);
        $plan = (string) ($fresh->effectivePlan() ?? 'free');
        $planLabel = TelegramInsights::planLabel($plan);

        $lines[] = '';
        $lines[] = '⭐ Уровень <b>'.$level.'</b> · Репутация <b>'.$reputation.'</b> · 💎 '.$planLabel;

        if ($fresh->isPendingDeletion()) {
            $days = $fresh->deletionDaysLeft() ?? 0;
            $lines[] = '⏳ Удаляется через <b>'.$days.' дн.</b>';
        } elseif ($fresh->isProfileHidden()) {
            $lines[] = '🙈 Анкета <b>скрыта</b> — вас никто не видит.';
        } else {
            $lines[] = '👀 Анкета <b>видна</b> — вас находят в ленте и поиске.';
        }

        $admirers = TelegramInsights::admirers($fresh);
        $matches = TelegramInsights::matches($fresh);
        $unread = TelegramInsights::unreadCount($fresh);

        $lines[] = '💞 Лайков: <b>'.$admirers['total'].'</b> · 🎉 Мэтчей: <b>'.$matches['total'].'</b> · 💬 Новых: <b>'.$unread.'</b>';

        $photoCount = 0;

        try {
            $photoCount = $fresh->profilePhotos()->count();
        } catch (\Throwable) {
            $photoCount = 0;
        }

        $photoLine = '📸 Фото: <b>'.$photoCount.'</b>';

        if (self::isOnline($fresh)) {
            $photoLine .= ' · 🟢 сейчас в сети';
        }

        $lines[] = $photoLine;

        $keyboard = [];

        if ($fresh->isPendingDeletion()) {
            $keyboard[] = [
                ['text' => '💚 Остаться (отменить удаление)', 'callback_data' => 'del_cancel'],
            ];
        } elseif ($fresh->isProfileHidden()) {
            $keyboard[] = [
                ['text' => '👀 Вернуть анкету', 'callback_data' => 'prof_show'],
            ];
        } else {
            $keyboard[] = [
                ['text' => '🙈 Скрыть анкету', 'callback_data' => 'prof_hide'],
            ];
        }

        $keyboard[] = [
            ['text' => '🔥 Найти мэтч здесь', 'callback_data' => 'sw_find'],
            ['text' => '🟢 Кто онлайн', 'callback_data' => 'go_online'],
        ];

        $keyboard[] = [
            ['text' => '💎 Мой тариф', 'callback_data' => 'go_plan'],
            ['text' => '📧 Моя почта', 'callback_data' => 'go_email'],
        ];

        $keyboard[] = [
            ['text' => '🔄 Обновить', 'callback_data' => 'prof_refresh'],
            TelegramMenu::openAppButton('🌐 Открыть анкету'),
        ];

        return [
            'text' => implode("\n", $lines),
            'photoUrl' => TelegramPhoto::bestFor($fresh),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Подпись пола для анкеты.
     *
     * @param string $gender male|female|other
     * @return string
     */
    private static function genderLabel(string $gender): string
    {
        return match ($gender) {
            'male' => 'Мужчина',
            'female' => 'Девушка',
            default => '',
        };
    }

    /**
     * Подпись цели знакомств.
     *
     * @param string $goal love|flirt|friendship|chat|interests
     * @return string
     */
    private static function goalLabel(string $goal): string
    {
        return match ($goal) {
            'love' => 'Отношения',
            'flirt' => 'Флирт',
            'friendship' => 'Дружба',
            'chat' => 'Общение',
            'interests' => 'По интересам',
            default => '',
        };
    }

    /**
     * В сети ли пользователь (last_seen в пределах онлайн-порога).
     *
     * Невидимка полностью скрывает онлайн и здесь: при активной
     * невидимке всегда оффлайн, даже для себя.
     *
     * @param User $user проверяемый
     * @return bool
     */
    private static function isOnline(User $user): bool
    {
        try {
            if ($user->isInvisibleActive()) {
                return false;
            }
        } catch (\Throwable) {
            return false;
        }

        if ($user->last_seen_at === null) {
            return false;
        }

        try {
            $threshold = \App\Services\MonitoringService::onlineThreshold();

            return \Carbon\Carbon::parse($user->last_seen_at)->gte($threshold);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Экранировать текст под parse_mode=HTML.
     *
     * @param string $text сырой текст
     * @return string
     */
    private static function esc(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
