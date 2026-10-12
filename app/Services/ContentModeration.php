<?php

namespace App\Services;

/**
 * Двухслойная модерация публичного контента (посты, комментарии, пины, районы, бизнес).
 *
 * Слой 1 (sync, быстрый): regex по словарям — блокирует создание (422) и
 * отдаёт флаги `moderation` для блюра в лентах.
 * Слой 2 (async): AI-вердикт через AiTextService + ModeratePublicContentJob.
 *
 * Чаты (MessageController/ConversationController) намеренно НЕ модерируются:
 * личная переписка — дело участников, там действуют только жалобы и блокировки.
 */
class ContentModeration
{
    public const TOPICS = [
        'politics' => 'Политика',
        'adult' => 'Контент 18+',
        'drugs' => 'Наркотики',
        'weapons' => 'Оружие',
        'hate' => 'Ненависть и экстремизм',
        'crime' => 'Незаконное и мошенничество',
        'profanity' => 'Нецензурная лексика',
    ];

    private const MESSAGES = [
        'politics' => 'Пины на политические темы запрещены правилами сервиса.',
        'adult' => 'Контент 18+ запрещён правилами сервиса.',
        'drugs' => 'Упоминание наркотиков запрещено — такой пин создать нельзя.',
        'weapons' => 'Упоминание оружия и взрывчатки запрещено правилами сервиса.',
        'hate' => 'Разжигание ненависти и экстремизм запрещены правилами сервиса.',
        'crime' => 'Незаконная деятельность и мошенничество запрещены правилами сервиса.',
        'profanity' => 'Мат и нецензурная лексика запрещены правилами сервиса.',
    ];

    private const EXACT = [
        'politics' => ['путин', 'зеленский', 'лукашенко', 'тихоновская', 'тихановская', 'бабарико', 'цепкало', 'латушко', 'байден', 'трамп', 'навальный', 'пригожин', 'шойгу', 'медведев', 'песков', 'лавров', 'мишустин', 'собянин', 'кадыров', 'соловьев', 'порошенко', 'залужный', 'бандера', 'выборы', 'референдум', 'митинг', 'протест', 'оппозиция', 'депутат', 'президент', 'правительство', 'парламент', 'госдума', 'майдан', 'революция', 'мобилизация', 'санкции', 'война', 'всу', 'нато', 'кремль', 'чиновник', 'коррупция', 'диктатура', 'омон', 'губопик', 'кгб', 'бчб', 'лукашизм', 'мвд', 'фсб', 'сво', 'днр', 'лнр', 'elections', 'protest', 'referendum', 'war'],
        'adult' => ['секс', 'порно', 'эскорт', 'интим', 'проституция', 'проститутка', 'оргия', 'минет', 'свингер', 'свингеры', 'педофилия', 'зоофилия', 'инцест', 'бдсм', 'sex', 'porn', 'escort'],
        'drugs' => ['героин', 'кокаин', 'мефедрон', 'марихуана', 'гашиш', 'амфетамин', 'метадон', 'спайс', 'экстази', 'лсд', 'мдма', 'закладка', 'heroin', 'cocaine', 'drugs'],
        'weapons' => ['оружие', 'пистолет', 'винтовка', 'ружье', 'граната', 'гранаты', 'взрывчатка', 'теракт', 'пулемет', 'weapon', 'bomb'],
        'hate' => ['геноцид', 'холокост', 'genocide'],
        'crime' => ['казино', 'обнал', 'взятка', 'отмывание', 'подделка', 'контрафакт', 'casino', 'bribe'],
        'profanity' => ['хуй', 'хуя', 'хуе', 'хую', 'хуем', 'хуи', 'хер', 'хера', 'херу', 'бля', 'блядь', 'сука', 'суки', 'суку', 'пидор', 'пидар', 'мудак', 'гандон', 'залупа', 'ебля', 'еблю', 'ебись', 'fuck', 'shit', 'bitch', 'whore'],
    ];

    private const STEMS = [
        'politics' => ['оппозици', 'революци', 'мобилизац', 'пропаганд', 'коррупци', 'лукашенк', 'тихановск', 'бабарик', 'диктатур', 'омон', 'бандеров'],
        'adult' => ['порно', 'порн', 'эскорт', 'интим', 'проститут', 'педофил', 'зоофил', 'эксгибициони', 'свингер'],
        'drugs' => ['наркотик', 'наркоторг', 'мефедрон', 'кокаин', 'героин', 'амфетамин', 'марихуан', 'гашиш', 'метадон', 'спайс', 'закладк', 'экстази'],
        'weapons' => ['оружи', 'пистолет', 'винтовк', 'пулемет', 'взрывчат', 'боеприпас', 'теракт', 'гранатомет'],
        'hate' => ['экстремист', 'террорист', 'нацист', 'фашист', 'расист', 'ксенофоб', 'шовини'],
        'crime' => ['казино', 'обнал', 'взятк', 'взяток', 'поддел', 'фальшив', 'контрафакт', 'отмывани', 'мошеннич'],
        'profanity' => ['пизд', 'бляд', 'блят', 'ебал', 'ебет', 'ебут', 'ебен', 'долбоеб', 'мудак', 'мудил', 'гандон', 'залуп', 'дроч', 'трах', 'сучк', 'пидор', 'пидар', 'изнасилов', 'ебуч', 'охуе', 'охуи', 'наху', 'поху', 'хуес', 'хуев', 'хуйн', 'хуяр'],
    ];

    private const PHRASES = [
        'politics' => ['единая россия', 'белый дом', 'всебелорусское собрание', 'всебеларусское собрание', 'день воли'],
        'adult' => ['интим услуги', 'интимные услуги'],
        'crime' => ['отмывание денег', 'поддельные документы'],
    ];

    public static function check(?string ...$texts): ?array
    {
        $raw = mb_strtolower(implode(' ', array_filter($texts, fn ($t) => is_string($t) && $t !== '')));

        if (trim($raw) === '') return null;

        $obfuscated = self::checkObfuscated($raw);

        if ($obfuscated !== null) return $obfuscated;

        $normalized = self::normalizeForCheck($raw);

        if ($normalized === '') return null;

        $words = preg_split('/[^\p{L}\p{N}]+/u', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $lookup = array_fill_keys($words, true);
        $padded = ' '.$normalized.' ';

        foreach (self::TOPICS as $topic => $label) {
            foreach (self::PHRASES[$topic] ?? [] as $phrase) {
                if (str_contains($padded, ' '.$phrase.' ')) {
                    return ['topic' => $topic, 'label' => $label, 'message' => self::MESSAGES[$topic]];
                }
            }
            foreach (self::EXACT[$topic] ?? [] as $word) {
                if (isset($lookup[$word])) {
                    return ['topic' => $topic, 'label' => $label, 'message' => self::MESSAGES[$topic]];
                }
            }
            foreach (self::STEMS[$topic] ?? [] as $stem) {
                if (mb_strlen($stem) < 4) continue;
                foreach ($words as $w) {
                    if (mb_strlen($w) >= 4 && str_contains($w, $stem)) {
                        return ['topic' => $topic, 'label' => $label, 'message' => self::MESSAGES[$topic]];
                    }
                }
            }
        }

        return null;
    }

    /**
     * Заблокировать публикацию при срабатывании regex (422).
     *
     * Админы и модераторы (`canModerate`) не ограничиваются: им модерация
     * нужна для работы (проверка жалоб, тестовые посты), а их контент
     * по определению доверенный.
     *
     * @param string|null ...$texts проверяемые поля
     */
    public static function assertClean(?string ...$texts): void
    {
        try {
            if (auth()->user()?->canModerate()) return;
        } catch (\Throwable) {
        }

        $hit = self::check(...$texts);
        if ($hit) abort(422, $hit['message']);
    }

    /**
     * Поймать мат с разделителями/масками внутри слова: "х*й", "п-и-з-д-а", "бля7ь".
     *
     * Между буквами корня допускается 0–2 любых не-букв. Проверяем сырой
     * lower-текст (до нормализации), латиницу тоже приводим к кириллице.
     *
     * @param string $raw сырой lower-текст
     * @return array{topic: string, label: string, message: string}|null
     */
    private static function checkObfuscated(string $raw): ?array
    {
        $latinToCyrillic = [
            'a' => 'а', 'b' => 'в', 'c' => 'с', 'd' => 'д', 'e' => 'е',
            'f' => 'ф', 'g' => 'г', 'h' => 'х', 'i' => 'и', 'j' => 'й',
            'k' => 'к', 'l' => 'л', 'm' => 'м', 'n' => 'н', 'o' => 'о',
            'p' => 'п', 'q' => 'к', 'r' => 'р', 's' => 'с', 't' => 'т',
            'u' => 'и', 'v' => 'в', 'w' => 'ш', 'x' => 'х', 'y' => 'у', 'z' => 'з',
        ];
        $text = strtr($raw, $latinToCyrillic);
        $text = str_replace('ё', 'е', $text);

        $roots = ['хуй', 'пизд', 'бляд', 'блят', 'ебал', 'ебет', 'ебут', 'сука', 'пидор', 'пидар', 'мудак', 'гандон', 'залуп', 'охуе', 'охуи', 'наху', 'поху', 'долбоеб', 'изнасилов'];

        foreach ($roots as $root) {
            $letters = mb_str_split($root);
            $quoted = array_map(fn ($ch) => preg_quote($ch, '/'), $letters);
            $pattern = '/'.implode('[^\\p{L}]{0,2}', $quoted).'/ui';

            if (preg_match($pattern, $text) === 1) {
                return ['topic' => 'profanity', 'label' => self::TOPICS['profanity'], 'message' => self::MESSAGES['profanity']];
            }
        }

        if (self::hasMaskedSwear($text)) {
            return ['topic' => 'profanity', 'label' => self::TOPICS['profanity'], 'message' => self::MESSAGES['profanity']];
        }

        return null;
    }

    /**
     * Токен с замаскированной буквой: "х*й", "п*зда", "б*дь", "с*ка", "м*дак".
     *
     * Маска (* # @ . - _ : | / \) заменяет 1–2 буквы внутри короткого слова
     * с «матерной» первой буквой. Отдельные слова без маски тут не трогаем,
     * чтобы не задеть невинное "х й".
     *
     * @param string $text lower-текст с приведённой латиницей
     * @return bool есть ли замаскированный мат
     */
    private static function hasMaskedSwear(string $text): bool
    {
        $tokens = preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        foreach ($tokens as $token) {
            if (! preg_match('/[*#@._\\-:|\/\\\\]/u', $token)) continue;

            $stripped = (string) preg_replace('/[^\\p{L}]/u', '', $token);
            $strippedLen = mb_strlen($stripped);

            if ($strippedLen < 2 || $strippedLen > 7) continue;

            $first = mb_substr($stripped, 0, 1);
            $last = mb_substr($stripped, -1, 1);

            if (! in_array($first, ['х', 'п', 'б', 'е', 'с', 'м', 'г', 'з', 'о', 'д'], true)) continue;

            if (preg_match('/^[хпбемсгзод][\\p{L}]{0,4}[йаьояукдл]$/u', $stripped) === 1) {
                if ($strippedLen <= 2 && ! in_array($stripped, ['ху', 'хй', 'пи', 'бл', 'су', 'еб'], true)) continue;

                return true;
            }
        }

        return false;
    }

    /**
     * Нормализовать текст для проверки: ё→е, латиница→кириллица,
     * символы-маски (@, *, 0, 3, 6) → буквы, схлопнуть повторы и разделители.
     *
     * Ловит обфускацию вида "п-и-з-д-а", "х*й", "бля7ь", "xyu", "suka".
     *
     * @param string $text исходный текст
     * @return string нормализованный текст
     */
    public static function normalizeForCheck(string $text): string
    {
        $joined = mb_strtolower(trim($text));

        if ($joined === '') return '';

        $joined = str_replace('ё', 'е', $joined);

        $latinToCyrillic = [
            'a' => 'а', 'b' => 'в', 'c' => 'с', 'd' => 'д', 'e' => 'е',
            'f' => 'ф', 'g' => 'г', 'h' => 'х', 'i' => 'и', 'j' => 'й',
            'k' => 'к', 'l' => 'л', 'm' => 'м', 'n' => 'н', 'o' => 'о',
            'p' => 'п', 'q' => 'к', 'r' => 'р', 's' => 'с', 't' => 'т',
            'u' => 'и', 'v' => 'в', 'w' => 'ш', 'x' => 'х', 'y' => 'у', 'z' => 'з',
        ];
        $joined = strtr($joined, $latinToCyrillic);

        $leetMap = [
            '@' => 'а', '0' => 'о', '3' => 'з', '6' => 'б', '4' => 'ч',
            '7' => 'т', '9' => 'д', '$' => 'с', '*' => '', '#' => '',
            '1' => 'и', '!' => 'и',
        ];
        $joined = strtr($joined, $leetMap);

        $joined = (string) preg_replace('/[.\-_~^|:\/\\\\]+/u', ' ', $joined);

        $joined = (string) preg_replace('/(.)\1{2,}/u', '$1$1', $joined);

        return trim($joined);
    }

    /**
     * Флаги модерации для сериализаторов: нужен ли блюр в ленте.
     *
     * Дешёвый sync-слой (regex). AI-доанализ делает фронт через
     * POST /api/ai/moderate и блюрит локально при вердикте is_toxic.
     *
     * @param string|null ...$texts проверяемые поля (title, body, content)
     * @return array{is_toxic: bool, category: string|null, label: string|null, blur: bool}
     */
    public static function flagsFor(?string ...$texts): array
    {
        $hit = self::check(...$texts);

        if ($hit === null) {
            return ['is_toxic' => false, 'category' => null, 'label' => null, 'blur' => false];
        }

        return [
            'is_toxic' => true,
            'category' => $hit['topic'],
            'label' => $hit['label'],
            'blur' => true,
        ];
    }

    /**
     * Замаскировать нецензурные фрагменты звёздочками для превью/пушей.
     *
     * Режет только profanity-стеммы, остальные категории отдаёт как есть
     * (их блокирует assertClean, а блюрит фронт).
     *
     * @param string|null $text исходный текст
     * @return string текст с *** вместо мата
     */
    public static function mask(?string $text): string
    {
        if (! is_string($text) || $text === '') return '';

        $masked = $text;

        foreach (self::STEMS['profanity'] ?? [] as $stem) {
            if (mb_strlen($stem) < 4) continue;

            $pattern = '/\p{L}*'.preg_quote($stem, '/').'\p{L}*/ui';
            $masked = (string) preg_replace_callback($pattern, static function (array $matches): string {
                $word = $matches[0];
                $len = mb_strlen($word);

                if ($len <= 2) return $word;

                return mb_substr($word, 0, 1).str_repeat('*', $len - 1);
            }, $masked);
        }

        foreach (self::EXACT['profanity'] ?? [] as $word) {
            $pattern = '/(?<![\p{L}])'.preg_quote($word, '/').'(?![\p{L}])/ui';
            $masked = (string) preg_replace($pattern, str_repeat('*', mb_strlen($word)), $masked);
        }

        return $masked;
    }
}
