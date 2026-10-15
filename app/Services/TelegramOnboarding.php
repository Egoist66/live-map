<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Анкета-онбординг в Telegram-боте перед поиском мэтчей.
 *
 * Та же анкета, что в браузерной регистрации (имя, пол, дата рождения,
 * цель, город), только пошагово в чате: текст + inline-кнопки.
 * Пока анкета не заполнена — мэтчи закрыты (/find и все sw_*-колбэки
 * упираются в текущий шаг), Mini App-кнопка выдаётся на финише.
 *
 * Состояние шага живёт в кеше (`tg:onboarding:{userId}`), ответы копятся
 * в `data` и пишутся в пользователя только на финише — недозаполненная
 * анкета профиль не портит. Отмена (`ob_cancel`) всё сносит и возвращает
 * в главное меню.
 */
class TelegramOnboarding
{
    /**
     * Шаги по порядку: имя → пол → дата рождения → цель → город.
     *
     * @var string[]
     */
    public const STEPS = ['name', 'gender', 'birth', 'goal', 'city'];

    /**
     * Цели знакомств как в браузерной форме (value => подпись).
     *
     * @var array<string, string>
     */
    public const GOALS = [
        'love' => '💘 Отношения',
        'flirt' => '😉 Флирт',
        'friendship' => '🤝 Дружба',
        'chat' => '💬 Общение',
        'interests' => '🎯 По интересам',
    ];

    /**
     * Имя-заглушка авторегистрации: с ним анкета считается незаполненной.
     */
    public const GUEST_NAME = 'Гость TG';

    /**
     * Ключ состояния онбординга.
     *
     * @param int $userId владелец
     * @return string
     */
    public static function stateKey(int $userId): string
    {
        return 'tg:onboarding:'.$userId;
    }

    /**
     * Заполнена ли анкета для поиска мэтчей.
     *
     * Требуется: настоящее имя, пол male/female (other ломает подборку
     * по полу в ленте), совершеннолетие, цель из списка. Город —
     * необязательный: его отсутствие мэтчам не мешает.
     *
     * @param User $user проверяемый
     * @return bool true — можно в /find и свайпы
     */
    public static function isComplete(User $user): bool
    {
        $name = trim((string) ($user->name ?? ''));

        if ($name === '' || $name === self::GUEST_NAME) {
            return false;
        }

        if (! in_array($user->gender, ['male', 'female'], true)) {
            return false;
        }

        if (! self::isAdultBirth($user->birth_date)) {
            return false;
        }

        if (! array_key_exists((string) ($user->dating_goal ?? ''), self::GOALS)) {
            return false;
        }

        return true;
    }

    /**
     * Совершеннолетняя ли дата рождения.
     *
     * @param mixed $birth birth_date пользователя
     * @return bool true — дата валидна и возраст 18+
     */
    public static function isAdultBirth(mixed $birth): bool
    {
        if ($birth === null || $birth === '') {
            return false;
        }

        try {
            $date = \Carbon\Carbon::parse($birth)->startOfDay();
        } catch (\Throwable) {
            return false;
        }

        $today = \Carbon\Carbon::today();

        if ($date->greaterThan($today) || $date->year < 1900) {
            return false;
        }

        return $date->diffInYears($today) >= 18;
    }

    /**
     * Список незаполненных полей для веб-формы онбординга.
     *
     * Бот идёт пошагово (firstMissingStep), веб показывает все поля
     * сразу — этому методу нужен именно список для подсветки.
     * Город в список не входит: он необязательный.
     *
     * @param User $user проверяемый
     * @return string[] подмножество ['name','gender','birth_date','dating_goal']
     */
    public static function missingFields(User $user): array
    {
        $missing = [];

        $name = trim((string) ($user->name ?? ''));

        if ($name === '' || $name === self::GUEST_NAME) {
            $missing[] = 'name';
        }

        if (! in_array($user->gender, ['male', 'female'], true)) {
            $missing[] = 'gender';
        }

        if (! self::isAdultBirth($user->birth_date)) {
            $missing[] = 'birth_date';
        }

        if (! array_key_exists((string) ($user->dating_goal ?? ''), self::GOALS)) {
            $missing[] = 'dating_goal';
        }

        return $missing;
    }

    /**
     * Загрузить состояние онбординга.
     *
     * @param int $userId владелец
     * @return array{step:string, data:array<string, mixed>, message_id:int}|null
     */
    public static function loadState(int $userId): ?array
    {
        if ($userId <= 0) {
            return null;
        }

        try {
            $raw = Cache::get(self::stateKey($userId));
        } catch (\Throwable) {
            return null;
        }

        if (! is_array($raw)) {
            return null;
        }

        $step = (string) ($raw['step'] ?? '');

        if (! in_array($step, self::STEPS, true)) {
            return null;
        }

        $data = $raw['data'] ?? [];

        return [
            'step' => $step,
            'data' => is_array($data) ? $data : [],
            'message_id' => (int) ($raw['message_id'] ?? 0),
        ];
    }

    /**
     * Начать (или продолжить) онбординг: панель первого незаполненного шага.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function startFor(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $state = self::loadState((int) $fresh->id);
        $data = $state['data'] ?? [];

        $step = self::firstMissingStep($fresh, $data);

        self::saveState((int) $fresh->id, $step, $data);

        return self::stepPanel($fresh, $step, $data);
    }

    /**
     * Первый незаполненный шаг с учётом уже введённого в этой сессии.
     *
     * @param User $user владелец
     * @param array<string, mixed> $data ответы текущей сессии
     * @return string шаг
     */
    public static function firstMissingStep(User $user, array $data): string
    {
        $name = trim((string) ($data['name'] ?? $user->name ?? ''));

        if ($name === '' || $name === self::GUEST_NAME) {
            return 'name';
        }

        $gender = (string) ($data['gender'] ?? $user->gender ?? '');

        if (! in_array($gender, ['male', 'female'], true)) {
            return 'gender';
        }

        $birth = $data['birth'] ?? null;

        if ($birth === null) {
            $birth = $user->birth_date;
        }

        if (! self::isAdultBirth($birth)) {
            return 'birth';
        }

        $goal = (string) ($data['goal'] ?? $user->dating_goal ?? '');

        if (! array_key_exists($goal, self::GOALS)) {
            return 'goal';
        }

        $cityAsked = (bool) ($data['city_asked'] ?? false);
        $city = trim((string) ($user->home_city ?? ''));

        if (! $cityAsked && $city === '') {
            return 'city';
        }

        return 'city';
    }

    /**
     * Панель шага: текст + клавиатура.
     *
     * @param User $user владелец
     * @param string $step шаг
     * @param array<string, mixed> $data ответы текущей сессии
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function stepPanel(User $user, string $step, array $data): array
    {
        $head = "📝 <b>Анкета для поиска мэтчей</b>\nЗаполним как в браузере — 5 коротких шагов, потом откроются свайпы и Mini App.\n\n";

        $cancelRow = [[['text' => '❌ Отмена', 'callback_data' => 'ob_cancel']]];

        if ($step === 'name') {
            $current = trim((string) ($user->name ?? ''));

            $text = $head."<b>Шаг 1/5 · Как тебя зовут?</b>\n";

            if ($current !== '' && $current !== self::GUEST_NAME) {
                $text .= 'Сейчас: <b>'.self::esc($current)."</b>\n";
            }

            $text .= 'Напиши имя следующим сообщением или оставь как есть.';

            return [
                'text' => $text,
                'keyboard' => TelegramMenu::withNav([
                    [['text' => '➡️ Оставить', 'callback_data' => 'ob_name:keep']],
                    ...$cancelRow,
                ]),
            ];
        }

        if ($step === 'gender') {
            return [
                'text' => $head."<b>Шаг 2/5 · Твой пол?</b>\nЖми кнопку или напиши словом.",
                'keyboard' => TelegramMenu::withNav([
                    [
                        ['text' => '👨 Мужчина', 'callback_data' => 'ob_g:male'],
                        ['text' => '👩 Девушка', 'callback_data' => 'ob_g:female'],
                    ],
                    ...$cancelRow,
                ]),
            ];
        }

        if ($step === 'birth') {
            return [
                'text' => $head."<b>Шаг 3/5 · Дата рождения?</b>\nНапиши датой: ДД.ММ.ГГГГ (например, 12.07.1997). Свайпы — строго 18+.",
                'keyboard' => TelegramMenu::withNav($cancelRow),
            ];
        }

        if ($step === 'goal') {
            $rows = [];

            foreach (self::GOALS as $value => $label) {
                $rows[] = [['text' => $label, 'callback_data' => 'ob_goal:'.$value]];
            }

            $rows[] = $cancelRow[0];

            return [
                'text' => $head."<b>Шаг 4/5 · Зачем ты здесь?</b>",
                'keyboard' => TelegramMenu::withNav($rows),
            ];
        }

        return [
            'text' => $head."<b>Шаг 5/5 · Твой город?</b>\nНапиши город или пропусти — подберём людей рядом позже.",
            'keyboard' => TelegramMenu::withNav([
                [['text' => '⏭️ Пропустить', 'callback_data' => 'ob_city:skip']],
                ...$cancelRow,
            ]),
        ];
    }

    /**
     * Ответить текстом на текущий шаг.
     *
     * Принимаем и кнопки-слова (пол/цель текстом), дату — в трёх форматах.
     * Ошибка валидации — тост, панель та же. Финиш — сохраняем пользователя,
     * сносим состояние и отдаём панель успеха.
     *
     * @param User $user владелец
     * @param string $text присланный текст
     * @return array{toast:string, panel:array{text:string, keyboard:array}|null, finished:bool, cancelled:bool, moved:bool}
     */
    public static function handleText(User $user, string $text): array
    {
        $fresh = $user->fresh() ?? $user;
        $uid = (int) $fresh->id;

        $state = self::loadState($uid);
        $data = $state['data'] ?? [];
        $step = $state['step'] ?? self::firstMissingStep($fresh, $data);

        $clean = trim($text);

        if ($step === 'name') {
            if (mb_strlen($clean) < 2 || mb_strlen($clean) > 40) {
                return self::retry($fresh, $step, $data, 'Имя — от 2 до 40 символов.');
            }

            $data['name'] = $clean;

            return self::advance($fresh, $data);
        }

        if ($step === 'gender') {
            $gender = self::parseGender($clean);

            if ($gender === null) {
                return self::retry($fresh, $step, $data, 'Жми кнопку или напиши «мужчина» / «девушка».');
            }

            $data['gender'] = $gender;

            return self::advance($fresh, $data);
        }

        if ($step === 'birth') {
            $birth = self::parseBirth($clean);

            if ($birth === null) {
                return self::retry($fresh, $step, $data, 'Формат ДД.ММ.ГГГГ, свайпы — строго 18+.');
            }

            $data['birth'] = $birth;

            return self::advance($fresh, $data);
        }

        if ($step === 'goal') {
            $goal = self::parseGoal($clean);

            if ($goal === null) {
                return self::retry($fresh, $step, $data, 'Жми кнопку или напиши цель словом.');
            }

            $data['goal'] = $goal;

            return self::advance($fresh, $data);
        }

        if (mb_strlen($clean) > 120) {
            return self::retry($fresh, $step, $data, 'Город — до 120 символов.');
        }

        $lower = mb_strtolower($clean);

        if (! in_array($lower, ['пропустить', 'skip', '-'], true) && $clean !== '') {
            $data['city'] = $clean;
        }

        $data['city_asked'] = true;

        return self::advance($fresh, $data);
    }

    /**
     * Ответить колбэком кнопок онбординга.
     *
     * @param User $user владелец
     * @param string $data callback_data ob_*
     * @return array{toast:string, panel:array|null, finished:bool, cancelled:bool, moved:bool}|null null — не наш колбэк
     */
    public static function handleCallback(User $user, string $data): ?array
    {
        if (! str_starts_with($data, 'ob_')) {
            return null;
        }

        $fresh = $user->fresh() ?? $user;
        $uid = (int) $fresh->id;

        if ($data === 'ob_cancel') {
            self::clearState($uid);

            return ['toast' => 'Анкета не сохранена', 'panel' => null, 'finished' => false, 'cancelled' => true, 'moved' => true];
        }

        $state = self::loadState($uid);
        $answers = $state['data'] ?? [];

        if ($data === 'ob_name:keep') {
            $current = trim((string) ($fresh->name ?? ''));

            if ($current !== '' && $current !== self::GUEST_NAME) {
                $answers['name'] = $current;

                return self::advance($fresh, $answers);
            }

            return self::retry($fresh, 'name', $answers, 'Сначала напиши имя — оставить пока нечего.');
        }

        if (str_starts_with($data, 'ob_g:')) {
            $gender = substr($data, strlen('ob_g:'));

            if (! in_array($gender, ['male', 'female'], true)) {
                return self::retry($fresh, 'gender', $answers, 'Жми кнопку.');
            }

            $answers['gender'] = $gender;

            return self::advance($fresh, $answers);
        }

        if (str_starts_with($data, 'ob_goal:')) {
            $goal = substr($data, strlen('ob_goal:'));

            if (! array_key_exists($goal, self::GOALS)) {
                return self::retry($fresh, 'goal', $answers, 'Жми кнопку.');
            }

            $answers['goal'] = $goal;

            return self::advance($fresh, $answers);
        }

        if ($data === 'ob_city:skip') {
            $answers['city_asked'] = true;

            return self::advance($fresh, $answers);
        }

        return null;
    }

    /**
     * Перейти к следующему шагу или финишировать.
     *
     * @param User $user владелец
     * @param array<string, mixed> $data накопленные ответы
     * @return array{toast:string, panel:array, finished:bool, cancelled:bool, moved:bool}
     */
    private static function advance(User $user, array $data): array
    {
        $fresh = $user->fresh() ?? $user;
        $uid = (int) $fresh->id;

        if (self::wouldBeComplete($fresh, $data)) {
            $cityNow = trim((string) ($data['city'] ?? $fresh->home_city ?? ''));
            $cityAsked = (bool) ($data['city_asked'] ?? false);

            if ($cityNow !== '' || $cityAsked) {
                return self::finish($fresh, $data);
            }
        }

        $step = self::firstMissingStep($fresh, $data);

        self::saveState($uid, $step, $data);

        return [
            'toast' => 'Принято ✅',
            'panel' => self::stepPanel($fresh, $step, $data),
            'finished' => false,
            'cancelled' => false,
            'moved' => true,
        ];
    }

    /**
     * Хватит ли накопленного для полной анкеты.
     *
     * @param User $user владелец
     * @param array<string, mixed> $data ответы сессии
     * @return bool true — имя/пол/возраст/цель закрыты
     */
    private static function wouldBeComplete(User $user, array $data): bool
    {
        $name = trim((string) ($data['name'] ?? $user->name ?? ''));

        if ($name === '' || $name === self::GUEST_NAME) {
            return false;
        }

        $gender = (string) ($data['gender'] ?? $user->gender ?? '');

        if (! in_array($gender, ['male', 'female'], true)) {
            return false;
        }

        $birth = $data['birth'] ?? $user->birth_date;

        if (! self::isAdultBirth($birth)) {
            return false;
        }

        $goal = (string) ($data['goal'] ?? $user->dating_goal ?? '');

        return array_key_exists($goal, self::GOALS);
    }

    /**
     * Сохранить анкету в пользователя и отдать финишную панель.
     *
     * @param User $user владелец
     * @param array<string, mixed> $data ответы сессии
     * @return array{toast:string, panel:array, finished:bool, cancelled:bool, moved:bool}
     */
    private static function finish(User $user, array $data): array
    {
        $fresh = $user->fresh() ?? $user;

        $patch = [
            'dating_enabled' => true,
        ];

        $name = trim((string) ($data['name'] ?? ''));

        if ($name !== '' && $name !== self::GUEST_NAME) {
            $patch['name'] = mb_substr($name, 0, 255);
        }

        $gender = (string) ($data['gender'] ?? '');

        if (in_array($gender, ['male', 'female'], true)) {
            $patch['gender'] = $gender;
        }

        $birth = $data['birth'] ?? null;

        if (is_string($birth) && self::isAdultBirth($birth)) {
            $patch['birth_date'] = $birth;
        }

        $goal = (string) ($data['goal'] ?? '');

        if (array_key_exists($goal, self::GOALS)) {
            $patch['dating_goal'] = $goal;
        }

        $city = trim((string) ($data['city'] ?? ''));

        if ($city !== '') {
            $patch['home_city'] = mb_substr($city, 0, 120);
        }

        try {
            $fresh->forceFill($patch)->save();
        } catch (\Throwable) {
        }

        self::clearState((int) $fresh->id);

        $text = "✅ <b>Анкета готова!</b>\n\nТеперь доступны поиск мэтчей здесь и Mini App — выбирай, где удобнее.";

        return [
            'toast' => 'Анкета готова ✅',
            'panel' => [
                'text' => $text,
                'keyboard' => TelegramMenu::withNav([
                    [
                        ['text' => '🔥 Найти мэтч', 'callback_data' => 'sw_find'],
                    ],
                    [
                        TelegramMenu::openAppButton('🌐 Открыть Mini App'),
                    ],
                ]),
            ],
            'finished' => true,
            'cancelled' => false,
            'moved' => true,
        ];
    }

    /**
     * Ошибка валидации: тот же шаг + тост.
     *
     * @param User $user владелец
     * @param string $step текущий шаг
     * @param array<string, mixed> $data ответы сессии
     * @param string $toast что сказать
     * @return array{toast:string, panel:array, finished:bool, cancelled:bool, moved:bool}
     */
    private static function retry(User $user, string $step, array $data, string $toast): array
    {
        self::saveState((int) $user->id, $step, $data);

        return [
            'toast' => $toast,
            'panel' => self::stepPanel($user, $step, $data),
            'finished' => false,
            'cancelled' => false,
            'moved' => false,
        ];
    }

    /**
     * Распознать пол из кнопки или текста.
     *
     * @param string $raw сырой ввод
     * @return string|null male|female либо null
     */
    private static function parseGender(string $raw): ?string
    {
        $lower = mb_strtolower(trim($raw));

        $male = ['male', 'м', 'муж', 'мужчина', 'мужской', 'man', 'male 👨', '👨'];

        $female = ['female', 'ж', 'жен', 'девушка', 'женщина', 'женский', 'woman', '👩'];

        if (in_array($lower, $male, true)) {
            return 'male';
        }

        if (in_array($lower, $female, true)) {
            return 'female';
        }

        return null;
    }

    /**
     * Распознать цель из кнопки или текста.
     *
     * @param string $raw сырой ввод
     * @return string|null ключ цели либо null
     */
    private static function parseGoal(string $raw): ?string
    {
        $lower = mb_strtolower(trim($raw));

        $map = [
            'love' => ['love', 'отношения', 'отношение', 'серьёзные', 'серьезные'],
            'flirt' => ['flirt', 'флирт'],
            'friendship' => ['friendship', 'дружба', 'друзья'],
            'chat' => ['chat', 'общение', 'общаться', 'переписка'],
            'interests' => ['interests', 'интересы', 'по интересам', 'хобби'],
        ];

        foreach ($map as $value => $aliases) {
            if (in_array($lower, $aliases, true)) {
                return $value;
            }
        }

        return null;
    }

    /**
     * Распознать дату рождения: ДД.ММ.ГГГГ, ДД/ММ/ГГГГ, ГГГГ-ММ-ДД.
     *
     * @param string $raw сырой ввод
     * @return string|null Y-m-d либо null
     */
    private static function parseBirth(string $raw): ?string
    {
        $clean = trim($raw);

        $parsed = null;

        if (preg_match('/^(\d{1,2})[.](\d{1,2})[.](\d{4})$/u', $clean, $m) === 1) {
            $parsed = [$m[3], $m[2], $m[1]];
        } elseif (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u', $clean, $m) === 1) {
            $parsed = [$m[3], $m[2], $m[1]];
        } elseif (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/u', $clean, $m) === 1) {
            $parsed = [$m[1], $m[2], $m[3]];
        }

        if ($parsed === null) {
            return null;
        }

        [$year, $month, $day] = [(int) $parsed[0], (int) $parsed[1], (int) $parsed[2]];

        if (! checkdate($month, $day, $year)) {
            return null;
        }

        $iso = sprintf('%04d-%02d-%02d', $year, $month, $day);

        if (! self::isAdultBirth($iso)) {
            return null;
        }

        return $iso;
    }

    /**
     * Сохранить состояние шага на сутки.
     *
     * id панели запоминаем, чтобы текстовые ответы перерисовывали тот же
     * шаг, а не спамили новыми сообщениями. Новый id передаём явно после
     * отправки/перерисовки, иначе храним прежний.
     *
     * @param int $userId владелец
     * @param string $step шаг
     * @param array<string, mixed> $data ответы
     * @param int|null $messageId id панели онбординга либо null — оставить прежний
     * @return void
     */
    private static function saveState(int $userId, string $step, array $data, ?int $messageId = null): void
    {
        if ($userId <= 0) {
            return;
        }

        if ($messageId === null || $messageId <= 0) {
            $prev = self::loadState($userId);
            $messageId = $prev !== null ? (int) ($prev['message_id'] ?? 0) : 0;
        }

        try {
            Cache::put(self::stateKey($userId), ['step' => $step, 'data' => $data, 'message_id' => $messageId], 86400);
        } catch (\Throwable) {
        }
    }

    /**
     * Запомнить id панели онбординга после отправки/перерисовки.
     *
     * @param int $userId владелец
     * @param int $messageId id сообщения с шагом
     * @return void
     */
    public static function setPanelMessage(int $userId, int $messageId): void
    {
        if ($userId <= 0 || $messageId <= 0) {
            return;
        }

        $state = self::loadState($userId);

        if ($state === null) {
            return;
        }

        self::saveState($userId, $state['step'], $state['data'], $messageId);
    }

    /**
     * Снести состояние онбординга.
     *
     * @param int $userId владелец
     * @return void
     */
    public static function clearState(int $userId): void
    {
        if ($userId <= 0) {
            return;
        }

        try {
            Cache::forget(self::stateKey($userId));
        } catch (\Throwable) {
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
