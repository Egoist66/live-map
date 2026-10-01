<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Свайпы прямо в Telegram-боте («Найти мэтч здесь»).
 *
 * Механика как в Mini App, только интерфейс — чат: бот показывает
 * по одной анкете текстом + кнопки «❤️ / 👎 / ➡️». Лайк/пас пишет
 * через DatingService::recordAction, при взаимности приходит мэтч.
 * Возраст 18+ обязателен — без birth_date просим подтвердить в приложении.
 */
class TelegramSwipePanel
{
    /**
     * Сколько анкет тянем за раз для бота (показываем первую непоказанную).
     */
    public const FEED_LIMIT = 10;

    /**
     * Ключ уже показанных в боте анкет (чтобы не крутить одних и тех же).
     *
     * @param int $userId владелец
     * @return string
     */
    public static function seenKey(int $userId): string
    {
        return 'tg:swipe:seen:'.$userId;
    }

    /**
     * Ключ ожидания почты (режим ввода email следующим сообщением).
     *
     * @param int $telegramId telegram_id владельца
     * @return string
     */
    public static function emailWaitKey(int $telegramId): string
    {
        return 'tg:email:wait:'.$telegramId;
    }

    /**
     * Взять следующую непоказанную анкету для бота.
     *
     * @param User $user зритель
     * @return array<string, mixed>|null карточка DatingService::cardFor либо null когда лента пуста
     */
    public static function nextCard(User $user): ?array
    {
        $fresh = $user->fresh() ?? $user;

        $seen = self::seenIds((int) $fresh->id);

        $dating = app(DatingService::class);

        try {
            $cards = $dating->feed($fresh, ['exclude_ids' => $seen], self::FEED_LIMIT);
        } catch (\Throwable) {
            return null;
        }

        if ($cards === []) {
            Cache::forget(self::seenKey((int) $fresh->id));

            try {
                $cards = $dating->feed($fresh, [], self::FEED_LIMIT);
            } catch (\Throwable) {
                return null;
            }
        }

        $first = $cards[0] ?? null;

        if (! is_array($first)) {
            return null;
        }

        self::rememberSeen((int) $fresh->id, (int) ($first['id'] ?? 0));

        return $first;
    }

    /**
     * Собрать текст, фото и клавиатуру карточки анкеты.
     *
     * Инфа полная, как в приложении: имя, возраст, пол, город,
     * дистанция, цель, «о себе», интересы, онлайн-статус. Фото —
     * отдельным полем (отправка через TelegramCardSender: sendPhoto
     * либо текст, когда https-фото нет).
     *
     * @param array<string, mixed> $card карточка из DatingService
     * @return array{text:string, photoUrl:string|null, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function card(array $card): array
    {
        $cardId = (int) ($card['id'] ?? 0);

        $name = trim((string) ($card['name'] ?? 'Без имени'));
        $age = $card['age'] ?? null;

        $title = $name;

        if ($age !== null) {
            $title .= ', '.$age;
        }

        $lines = [];
        $lines[] = '💘 <b>'.self::esc($title).'</b>';

        $meta = [];

        $genderLabel = self::genderLabel((string) ($card['gender'] ?? ''));

        if ($genderLabel !== '') {
            $meta[] = $genderLabel;
        }

        $city = trim((string) ($card['city'] ?? ''));

        if ($city !== '') {
            $meta[] = self::esc($city);
        }

        $distance = $card['distance_km'] ?? null;

        if (is_numeric($distance)) {
            $meta[] = self::esc((string) $distance).' км';
        }

        $goalLabel = self::goalLabel((string) ($card['goal'] ?? ''));

        if ($goalLabel !== '') {
            $meta[] = 'цель: '.self::esc($goalLabel);
        }

        if ($meta !== []) {
            $lines[] = implode(' · ', $meta);
        }

        $customGoal = trim((string) ($card['custom_goal'] ?? ''));

        if ($customGoal !== '') {
            $lines[] = '💭 '.self::esc(mb_substr($customGoal, 0, 120));
        }

        $about = trim((string) ($card['about'] ?? ''));

        if ($about !== '') {
            $lines[] = '';
            $lines[] = self::esc(mb_substr($about, 0, 300));
        }

        $interests = $card['interests'] ?? [];

        if (is_array($interests) && $interests !== []) {
            $tags = array_slice(array_map('strval', $interests), 0, 5);
            $escaped = array_map(fn (string $tag): string => self::esc($tag), $tags);
            $lines[] = '';
            $lines[] = '🏷 '.implode(', ', $escaped);
        }

        $statusLine = self::statusLine($card);

        if ($statusLine !== '') {
            $lines[] = '';
            $lines[] = $statusLine;
        }

        if (! empty($card['liked_me'])) {
            $lines[] = '💞 Этот человек уже лайкнул вас — взаимность даст мэтч!';
        }

        $keyboard = [
            [
                ['text' => '❤️ Нравится', 'callback_data' => 'sw_like:'.$cardId],
                ['text' => '👎 Пас', 'callback_data' => 'sw_pass:'.$cardId],
            ],
            [
                ['text' => '👤 Анкета целиком', 'callback_data' => 'sw_view:'.$cardId],
                ['text' => '➡️ Дальше', 'callback_data' => 'sw_find'],
            ],
            [
                TelegramMenu::openAppButton('🌐 Открыть свайпы'),
            ],
        ];

        return [
            'text' => implode("\n", $lines),
            'photoUrl' => self::cardPhoto($card),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Полная анкета кандидата для кнопки «Анкета целиком».
     *
     * Приватность соблюдаем как в ленте: скрытое имя/возраст/дистанция
     * не раскрываем, чужую/недоступную анкету не показываем (null).
     *
     * @param User $viewer кто смотрит
     * @param int $candidateId чью анкету открыть
     * @return array{text:string, photoUrl:string|null, keyboard:array<int, array<int, array<string, mixed>>>}|null
     */
    public static function detailsFor(User $viewer, int $candidateId): ?array
    {
        if ($candidateId <= 0) {
            return null;
        }

        $candidate = User::find($candidateId);

        if ($candidate === null) {
            return null;
        }

        $fresh = $viewer->fresh() ?? $viewer;

        try {
            $allowed = $candidate->isDiscoverableBy($fresh);
        } catch (\Throwable) {
            return null;
        }

        if (! $allowed) {
            return null;
        }

        try {
            $blocked = \App\Models\UserBlock::where('blocker_id', $candidateId)
                ->where('blocked_id', $fresh->id)
                ->exists();
        } catch (\Throwable) {
            $blocked = false;
        }

        if ($blocked) {
            return null;
        }

        $dating = app(DatingService::class);

        try {
            $isMatch = $dating->isMatched((int) $fresh->id, $candidateId);
        } catch (\Throwable) {
            $isMatch = false;
        }

        $likedMe = false;

        try {
            $likedMe = \App\Models\SwipeAction::where('liker_id', $candidateId)
                ->where('liked_id', $fresh->id)
                ->where('action', 'like')
                ->exists();
        } catch (\Throwable) {
            $likedMe = false;
        }

        $card = $dating->cardFor($candidate, $fresh, null, $isMatch, $likedMe);
        $built = self::card($card);

        $keyboard = [
            [
                ['text' => '❤️ Нравится', 'callback_data' => 'sw_like:'.$candidateId],
                ['text' => '👎 Пас', 'callback_data' => 'sw_pass:'.$candidateId],
            ],
            [
                ['text' => '➡️ Дальше', 'callback_data' => 'sw_find'],
                TelegramMenu::openAppButton('🌐 Открыть в приложении'),
            ],
        ];

        return [
            'text' => $built['text'],
            'photoUrl' => $built['photoUrl'],
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Фото карточки: первое https-фото либо аватар.
     *
     * @param array<string, mixed> $card карточка из DatingService
     * @return string|null
     */
    private static function cardPhoto(array $card): ?string
    {
        $photos = $card['photos'] ?? [];

        if (is_array($photos)) {
            foreach ($photos as $photo) {
                $absolute = TelegramPhoto::absolutize((string) $photo);

                if ($absolute !== null) {
                    return $absolute;
                }
            }
        }

        return TelegramPhoto::absolutize((string) ($card['avatar_url'] ?? ''));
    }

    /**
     * Строка онлайн-статуса кандидата.
     *
     * @param array<string, mixed> $card карточка из DatingService
     * @return string пусто когда неизвестно
     */
    private static function statusLine(array $card): string
    {
        $lastSeenRaw = $card['last_seen_at'] ?? null;

        if (! is_string($lastSeenRaw) || $lastSeenRaw === '') {
            return '';
        }

        try {
            $seen = \Carbon\Carbon::parse($lastSeenRaw);
            $threshold = \App\Services\MonitoringService::onlineThreshold();
        } catch (\Throwable) {
            return '';
        }

        if ($seen->gte($threshold)) {
            return '🟢 сейчас в сети';
        }

        return '';
    }

    /**
     * Подпись пола.
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
            default => $goal,
        };
    }

    /**
     * Стартовый экран режима «Найти мэтч здесь».
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function intro(): array
    {
        $text = "🔥 <b>Найти мэтч здесь</b>\n\nПоказываю анкеты по одной прямо в чате — как свайпы в приложении, только кнопками:\n❤️ — лайк, 👎 — пас, ➡️ — дальше без оценки.\n\nПри взаимности сразу напишу о мэтче.";

        $keyboard = [
            [
                ['text' => '🔥 Показать анкету', 'callback_data' => 'sw_find'],
            ],
            [
                TelegramMenu::openAppButton('🌐 Открыть свайпы'),
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Экран пустой ленты.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function empty(): array
    {
        $text = "🤷 Анкеты пока кончились — вы всех уже оценили.\nЗагляните позже или сбросьте историю — лента станет свежей.";

        $keyboard = [
            [
                ['text' => '🔄 Попробовать снова', 'callback_data' => 'sw_find'],
                ['text' => '🧹 Сбросить просмотренные', 'callback_data' => 'go_reset'],
            ],
            [
                TelegramMenu::openAppButton('🌐 Открыть свайпы'),
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Экран возрастного гейта (строго 18+).
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function ageGate(): array
    {
        $text = "🔞 Свайпы — строго с 18 лет.\nПодтвердите дату рождения в приложении (раздел ULove), затем возвращайтесь сюда.";

        $keyboard = [
            [
                TelegramMenu::openAppButton('🌐 Подтвердить возраст'),
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Забыть показанное в боте (после сброса истории свайпов).
     *
     * @param int $userId владелец
     * @return void
     */
    public static function clearSeen(int $userId): void
    {
        try {
            Cache::forget(self::seenKey($userId));
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Прочитанные id показанных анкет.
     *
     * @param int $userId владелец
     * @return array<int>
     */
    private static function seenIds(int $userId): array
    {
        try {
            $raw = Cache::get(self::seenKey($userId), []);
        } catch (\Throwable) {
            return [];
        }

        if (! is_array($raw)) {
            return [];
        }

        $ids = [];

        foreach (array_slice($raw, 0, 200) as $id) {
            $int = (int) $id;

            if ($int > 0) {
                $ids[] = $int;
            }
        }

        return $ids;
    }

    /**
     * Запомнить показанную анкету.
     *
     * @param int $userId владелец
     * @param int $cardId кого показали
     * @return void
     */
    private static function rememberSeen(int $userId, int $cardId): void
    {
        if ($cardId <= 0) {
            return;
        }

        $seen = self::seenIds($userId);
        $seen[] = $cardId;

        $seen = array_values(array_unique($seen));
        $seen = array_slice($seen, -200);

        try {
            Cache::put(self::seenKey($userId), $seen, 86400);
        } catch (\Throwable) {
            return;
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
