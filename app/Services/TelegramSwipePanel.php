<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Свайпы прямо в Telegram-боте («Найти мэтч здесь»).
 *
 * Механика как в Mini App, только интерфейс — чат: бот показывает
 * по одной анкете текстом + кнопки «❤️ / 👎» и «👤 Анкета целиком».
 * Кнопки «дальше» нет сознательно: следующий кандидат приезжает сам
 * после лайка/паса. Лайк/пас пишет через DatingService::recordAction,
 * при взаимности приходит мэтч. Возраст 18+ обязателен — дату рождения
 * спрашиваем в онбординге бота (TelegramOnboarding) до первого /find.
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
     * дистанция, цель, «о себе», интересы, онлайн-статус, звёзды
     * рейтинга и предупреждение о низкой репутации. Фото —
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

        $ratingLine = self::ratingLine($card);

        if ($ratingLine !== '') {
            $lines[] = $ratingLine;
        }

        $trustWarning = self::trustWarning($card);

        if ($trustWarning !== '') {
            $lines[] = '';
            $lines[] = $trustWarning;
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
     * Полный текст анкеты для кнопки «Анкета целиком».
     *
     * В отличие от короткой карточки ленты здесь ничего не режем:
     * полное «о себе», все интересы, подпись профиля. Лимиты только
     * технические: подпись под фото — до 950 символов (лимит Bot API
     * 1024), текстовое сообщение — до 3500 (лимит 4096 с запасом
     * под разметку). Режем аккуратно по словам с многоточием.
     *
     * @param array<string, mixed> $card карточка из DatingService
     * @param bool $hasPhoto уйдёт ли текст подписью под фото
     * @return string готовый HTML-текст
     */
    private static function fullCardText(array $card, bool $hasPhoto): string
    {
        $name = trim((string) ($card['name'] ?? 'Без имени'));
        $age = $card['age'] ?? null;

        $title = $name;

        if ($age !== null) {
            $title .= ', '.$age;
        }

        $lines = [];
        $lines[] = '👤 <b>'.self::esc($title).'</b>';

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
            $lines[] = '';
            $lines[] = '💭 '.self::esc($customGoal);
        }

        $bio = trim((string) ($card['bio'] ?? ''));

        if ($bio !== '') {
            $lines[] = '';
            $lines[] = '📝 '.self::esc($bio);
        }

        $about = trim((string) ($card['about'] ?? ''));

        if ($about !== '') {
            $lines[] = '';
            $lines[] = '💬 '.self::esc($about);
        }

        $interests = $card['interests'] ?? [];

        if (is_array($interests) && $interests !== []) {
            $tags = array_values(array_filter(array_map('strval', $interests)));
            $escaped = array_map(fn (string $tag): string => self::esc($tag), $tags);
            $lines[] = '';
            $lines[] = '🏷 '.implode(', ', $escaped);
        }

        $statusLine = self::statusLine($card);

        if ($statusLine !== '') {
            $lines[] = '';
            $lines[] = $statusLine;
        }

        $ratingLine = self::ratingLine($card);

        if ($ratingLine !== '') {
            $lines[] = $ratingLine;
        }

        $trustWarning = self::trustWarning($card);

        if ($trustWarning !== '') {
            $lines[] = '';
            $lines[] = $trustWarning;
        }

        if (! empty($card['liked_me'])) {
            $lines[] = '';
            $lines[] = '💞 Этот человек уже лайкнул вас — взаимность даст мэтч!';
        }

        $text = implode("\n", $lines);
        $limit = $hasPhoto ? 950 : 3500;

        if (mb_strlen($text) <= $limit) {
            return $text;
        }

        $cut = mb_substr($text, 0, $limit - 1);
        $lastBreak = mb_strrpos($cut, "\n");

        if ($lastBreak !== false && $lastBreak > (int) ($limit * 0.5)) {
            $cut = mb_substr($cut, 0, $lastBreak);
        }

        return rtrim($cut).'…';
    }

    /**
     * Полная анкета кандидата для кнопки «Анкета целиком».
     *
     * Приватность соблюдаем как в ленте: скрытое имя/возраст/дистанция
     * не раскрываем, чужую/недоступную анкету не показываем (null).
     * Сборку карточки оборачиваем в try/catch с запасным коротким
     * текстом: лучше показать имя + кнопку приложения, чем ронять
     * колбэк в «Анкета недоступна» на ровном месте.
     *
     * @param User $viewer кто смотрит
     * @param int $candidateId чью анкету открыть
     * @return array{text:string, photoUrl:string|null, keyboard:array<int, array<int, array<string, mixed>>>}|null
     */
    public static function detailsFor(User $viewer, int $candidateId): ?array
    {
        $keyboard = [
            [
                ['text' => '❤️ Нравится', 'callback_data' => 'sw_like:'.$candidateId],
                ['text' => '👎 Пас', 'callback_data' => 'sw_pass:'.$candidateId],
            ],
            [
                ['text' => '◀️ В свайпы', 'callback_data' => 'sw_back:'.$candidateId],
            ],
        ];

        $loaded = self::loadCandidateCard($viewer->fresh() ?? $viewer, $candidateId);

        if ($loaded['status'] === 'denied') {
            return null;
        }

        $raw = $loaded['card'];

        if ($raw === null) {
            $candidate = $loaded['candidate'];
            $fallbackName = trim((string) ($candidate?->name ?? ''));

            if ($fallbackName === '') {
                return null;
            }

            return [
                'text' => '👤 <b>'.self::esc($fallbackName).'</b>'."\n\nПолный текст анкеты не загрузился — откройте её в приложении.",
                'photoUrl' => $candidate !== null
                    ? TelegramPhoto::absolutize((string) ($candidate->avatar_url ?? ''))
                    : null,
                'keyboard' => TelegramMenu::withNav($keyboard),
            ];
        }

        $photoUrl = self::cardPhoto($raw);

        return [
            'text' => self::fullCardText($raw, $photoUrl !== null),
            'photoUrl' => $photoUrl,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Короткая карточка кандидата для кнопки «◀️ В свайпы».
     *
     * Возвращает к оценке того же человека: те же ❤️/👎 и «Анкета целиком».
     * Приватность та же, что у полной анкеты; любая проблема
     * сборки — null, контроллер едет к следующей анкете.
     *
     * @param User $viewer кто смотрит
     * @param int $candidateId чья карточка
     * @return array{text:string, photoUrl:string|null, keyboard:array<int, array<int, array<string, mixed>>>}|null
     */
    public static function shortCardFor(User $viewer, int $candidateId): ?array
    {
        $loaded = self::loadCandidateCard($viewer->fresh() ?? $viewer, $candidateId);

        if ($loaded['status'] === 'denied') {
            return null;
        }

        $raw = $loaded['card'];

        if ($raw === null) {
            return null;
        }

        $built = self::card($raw);

        return [
            'text' => $built['text'],
            'photoUrl' => $built['photoUrl'],
            'keyboard' => $built['keyboard'],
        ];
    }

    /**
     * Загрузить сырую карточку кандидата с проверкой приватности.
     *
     * Единая точка для полной анкеты и кнопки «Назад»: denied —
     * чужое/скрытое/заблокировавшее (показывать нельзя), card=null —
     * приватность ок, но сборка упала (можно показать запасной текст).
     *
     * @param User $viewer кто смотрит
     * @param int $candidateId чья анкета
     * @return array{status:string, card:array<string, mixed>|null, candidate:User|null}
     */
    private static function loadCandidateCard(User $viewer, int $candidateId): array
    {
        $denied = ['status' => 'denied', 'card' => null, 'candidate' => null];

        if ($candidateId <= 0) {
            return $denied;
        }

        $candidate = User::find($candidateId);

        if ($candidate === null) {
            return $denied;
        }

        $fresh = $viewer->fresh() ?? $viewer;

        try {
            $allowed = $candidate->isDiscoverableBy($fresh);
        } catch (\Throwable) {
            return $denied;
        }

        if (! $allowed) {
            return $denied;
        }

        try {
            $blocked = \App\Models\UserBlock::where('blocker_id', $candidateId)
                ->where('blocked_id', $fresh->id)
                ->exists();
        } catch (\Throwable) {
            $blocked = false;
        }

        if ($blocked) {
            return $denied;
        }

        try {
            $card = self::buildCandidateCard($fresh, $candidate, $candidateId);
        } catch (\Throwable) {
            return ['status' => 'ok', 'card' => null, 'candidate' => $candidate];
        }

        return ['status' => 'ok', 'card' => $card, 'candidate' => $candidate];
    }

    /**
     * Собрать полную карточку кандидата (мэтч/лайк-флаги + текст без купюр).
     *
     * @param User $viewer кто смотрит
     * @param User $candidate чья анкета
     * @param int $candidateId id для клавиатуры
     * @return array{text:string, photoUrl:string|null}
     *
     * @throws \Throwable когда не собрались рейтинг/свайп-флаги
     */
    private static function buildCandidateCard(User $viewer, User $candidate, int $candidateId): array
    {
        $dating = app(DatingService::class);

        $isMatch = $dating->isMatched((int) $viewer->id, $candidateId);

        $likedMe = \App\Models\SwipeAction::where('liker_id', $candidateId)
            ->where('liked_id', $viewer->id)
            ->where('action', 'like')
            ->exists();

        $card = $dating->cardFor($candidate, $viewer, null, $isMatch, $likedMe);

        $photoUrl = self::cardPhoto($card);

        return [
            'text' => self::fullCardText($card, $photoUrl !== null),
            'photoUrl' => $photoUrl,
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
     * Строка рейтинга кандидата: звёзды и число отзывов.
     *
     * Скрытый (PRO+) и пустой рейтинг не показываем — как в Mini App.
     *
     * @param array<string, mixed> $card карточка из DatingService
     * @return string пусто когда показать нечего
     */
    private static function ratingLine(array $card): string
    {
        if (! empty($card['rating_hidden'])) {
            return '';
        }

        $count = (int) ($card['rating_count'] ?? 0);
        $avg = $card['rating_avg'] ?? null;

        if ($count <= 0 || ! is_numeric($avg)) {
            return '';
        }

        return '⭐ '.round((float) $avg, 1).' ('.$count.' '.self::plural($count, 'отзыв', 'отзыва', 'отзывов').')';
    }

    /**
     * Предупреждение о низкой репутации: как жёлтый баннер в свайпах.
     *
     * Показываем при трасте 1–4 или звёздах ниже 3 — с числами,
     * чтобы было понятно, с кем имеешь дело. Детали — в FAQ.
     *
     * @param array<string, mixed> $card карточка из DatingService
     * @return string пусто когда всё в порядке
     */
    private static function trustWarning(array $card): string
    {
        $trustRaw = $card['trust_score'] ?? null;
        $trust = is_numeric($trustRaw) ? max(1, min(10, (int) round((float) $trustRaw))) : null;

        $count = (int) ($card['rating_count'] ?? 0);
        $avg = $card['rating_avg'] ?? null;
        $lowRating = empty($card['rating_hidden']) && $count > 0 && is_numeric($avg) && (float) $avg < 3;

        if (($trust === null || $trust > 4) && ! $lowRating) {
            return '';
        }

        $parts = [];

        if ($trust !== null) {
            $label = '';

            try {
                $label = (string) (TrustScoreService::zoneFor($trust)['label'] ?? '');
            } catch (\Throwable) {
                $label = '';
            }

            $parts[] = 'репутация '.$trust.' из 10'.($label !== '' ? ' · '.$label : '');
        }

        $ratingLine = self::ratingLine($card);

        if ($ratingLine !== '') {
            $parts[] = $ratingLine;
        }

        $numbers = $parts !== [] ? ' — '.implode(' · ', $parts) : '';

        return '⚠️ <b>Осторожно: низкая репутация</b>'.$numbers."\nУ профиля много жалоб, блокировок или плохих отзывов. Детали — в FAQ: отзывы и репутация.";
    }

    /**
     * Форма множественного числа для счётчиков.
     *
     * @param int $count число
     * @param string $one 1 отзыв
     * @param string $few 2 отзыва
     * @param string $many 5 отзывов
     * @return string подходящая форма
     */
    private static function plural(int $count, string $one, string $few, string $many): string
    {
        $mod100 = abs($count) % 100;
        $mod10 = $mod100 % 10;

        if ($mod100 > 10 && $mod100 < 20) {
            return $many;
        }

        if ($mod10 > 1 && $mod10 < 5) {
            return $few;
        }

        if ($mod10 === 1) {
            return $one;
        }

        return $many;
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
        $text = "🔥 <b>Найти мэтч здесь</b>\n\nПоказываю анкеты по одной прямо в чате — как свайпы в приложении, только кнопками:\n❤️ — лайк, 👎 — пас, 👤 — анкета целиком.\n\nСледующая анкета приезжает сама после оценки. При взаимности сразу напишу о мэтче.";

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
