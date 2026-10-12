<?php

namespace App\Services;

use Blaspsoft\Blasp\Facades\Blasp;
use Illuminate\Support\Facades\Log;

/**
 * Модерация публичного контента — полностью локальная, без ИИ и токенов.
 *
 * Движок мата — библиотека Blasp (blaspsoft/blasp): regex-драйвер ловит
 * leet-подмены (о→0, а→@), дубли букв (гряяязь) и разделители (п-и-з-д-а,
 * х*й). Английский словарь встроен в пакет, русский живёт в нашем
 * языковом пакете config/languages/russian.php (в апстриме его нет).
 *
 * Два адаптера поверх Blasp — только там, где библиотека слепа:
 * - транслит (suka, xyu): Blasp не переводит латиницу в кириллицу,
 *   поэтому проверяем и канонизированную копию текста;
 * - границы кириллических слов (мандарин, Херсон): байтовые \w-границы
 *   Blasp кириллицу не видят, отсекаем такие совпадения сами.
 *
 * Темы (политика, 18+, наркотики, оружие, ненависть, криминал) Blasp
 * не покрывает — их ловят словари ниже, как раньше.
 *
 * Режимы (вопрос «блокировать или ***»): по умолчанию — блокировка
 * публикации через assertClean (422). Для превью/пушей — mask(): тот же
 * мат, но звёздочками вместо отказа.
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
    ];

    private const STEMS = [
        'politics' => ['оппозици', 'революци', 'мобилизац', 'пропаганд', 'коррупци', 'лукашенк', 'тихановск', 'бабарик', 'диктатур', 'омон', 'бандеров'],
        'adult' => ['порно', 'порн', 'эскорт', 'интим', 'проститут', 'педофил', 'зоофил', 'эксгибициони', 'свингер'],
        'drugs' => ['наркотик', 'наркоторг', 'мефедрон', 'кокаин', 'героин', 'амфетамин', 'марихуан', 'гашиш', 'метадон', 'спайс', 'закладк', 'экстази'],
        'weapons' => ['оружи', 'пистолет', 'винтовк', 'пулемет', 'взрывчат', 'боеприпас', 'теракт', 'гранатомет'],
        'hate' => ['экстремист', 'террорист', 'нацист', 'фашист', 'расист', 'ксенофоб', 'шовини'],
        'crime' => ['казино', 'обнал', 'взятк', 'взяток', 'поддел', 'фальшив', 'контрафакт', 'отмывани', 'мошеннич'],
    ];

    private const PHRASES = [
        'politics' => ['единая россия', 'белый дом', 'всебелорусское собрание', 'всебеларусское собрание', 'день воли'],
        'adult' => ['интим услуги', 'интимные услуги'],
        'crime' => ['отмывание денег', 'поддельные документы'],
    ];

    /**
     * Языки Blasp для проверки мата: наш русский пак + встроенный английский.
     *
     * @var list<string>
     */
    private const BLASP_LANGUAGES = ['russian', 'english'];

    /**
     * Кэш известных матерных слов (для граничного фильтра кириллицы).
     *
     * @var array<string, true>|null
     */
    private static ?array $profanityWords = null;

    /**
     * Проверить тексты: сначала темы, затем мат через Blasp.
     *
     * @param  string|null  ...$texts  проверяемые поля
     * @return array{topic: string, label: string, message: string}|null
     */
    public static function check(?string ...$texts): ?array
    {
        $joined = implode(' ', array_filter($texts, static fn ($text): bool => is_string($text) && $text !== ''));

        if (trim($joined) === '') {
            return null;
        }

        $topicHit = self::checkTopics($joined);

        if ($topicHit !== null) {
            return $topicHit;
        }

        if (self::hasProfanity($joined)) {
            return ['topic' => 'profanity', 'label' => self::TOPICS['profanity'], 'message' => self::MESSAGES['profanity']];
        }

        return null;
    }

    /**
     * Заблокировать публикацию при срабатывании фильтров (422).
     *
     * Админы и модераторы (`canModerate`) не ограничиваются: им модерация
     * нужна для работы (проверка жалоб, тестовые посты), а их контент
     * по определению доверенный.
     *
     * @param  string|null  ...$texts  проверяемые поля
     */
    public static function assertClean(?string ...$texts): void
    {
        try {
            if (auth()->user()?->canModerate()) {
                return;
            }
        } catch (\Throwable) {
        }

        $hit = self::check(...$texts);

        if ($hit) {
            abort(422, $hit['message']);
        }
    }

    /**
     * Флаги модерации для сериализаторов: нужен ли блюр в ленте.
     *
     * @param  string|null  ...$texts  проверяемые поля (title, body, content)
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
     * Замаскировать мат звёздочками для превью/пушей (режим «mask»).
     *
     * Маскирует через Blasp clean() — те же слова, что ловит check().
     * Чисто транслитный мат (suka) в оригинале не закрасится: такие тексты
     * всё равно блокируются на публикации и блюрятся флагами в лентах.
     *
     * @param  string|null  $text  исходный текст
     * @return string текст с *** вместо мата
     */
    public static function mask(?string $text): string
    {
        if (! is_string($text) || $text === '') {
            return '';
        }

        try {
            $cleaned = Blasp::in(...self::BLASP_LANGUAGES)->check($text)->clean();
        } catch (\Throwable) {
            return $text;
        }

        if ($cleaned !== $text) {
            return $cleaned;
        }

        if (! self::hasProfanity($text)) {
            return $text;
        }

        try {
            $canonical = self::canonicalize(mb_strtolower(trim($text)), 'phonA');

            return Blasp::in(...self::BLASP_LANGUAGES)->check($canonical)->clean();
        } catch (\Throwable) {
            return $text;
        }
    }

    /**
     * Проверить темы (политика, 18+, наркотики, оружие, ненависть, криминал).
     *
     * Проходим по всем вариантам написания (оригинал + транслит-копии):
     * оригинал ловит латиницу (war, elections), копии — транслит
     * (putin → путин).
     *
     * @param  string  $text  склеенный текст
     * @return array{topic: string, label: string, message: string}|null
     */
    private static function checkTopics(string $text): ?array
    {
        foreach (self::variants($text) as $variant) {
            $normalized = (string) preg_replace('/[.\-_~^|:\/\\\\]+/u', ' ', $variant);
            $normalized = trim((string) preg_replace('/\s+/u', ' ', $normalized));

            if ($normalized === '') {
                continue;
            }

            $hit = self::matchTopics($normalized);

            if ($hit !== null) {
                return $hit;
            }
        }

        return null;
    }

    /**
     * Сопоставить нормализованный текст со словарями тем.
     *
     * @param  string  $normalized  lower-текст с пробелами вместо разделителей
     * @return array{topic: string, label: string, message: string}|null
     */
    private static function matchTopics(string $normalized): ?array
    {
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
                if (mb_strlen($stem) < 4) {
                    continue;
                }

                foreach ($words as $word) {
                    $isLongEnough = mb_strlen($word) >= 4;
                    $containsStem = str_contains($word, $stem);

                    if ($isLongEnough && $containsStem) {
                        return ['topic' => $topic, 'label' => $label, 'message' => self::MESSAGES[$topic]];
                    }
                }
            }
        }

        return null;
    }

    /**
     * Есть ли мат: Blasp по оригиналу и транслит-копиям.
     *
     * Оригинал ловит английский и прямой русский мат, копии —
     * транслит (suka → сука, blyad → бляд) и цифровые вставки (ху0й → хуй).
     *
     * @param  string  $text  склеенный текст
     * @return bool true когда мат подтверждён граничным фильтром
     */
    private static function hasProfanity(string $text): bool
    {
        foreach (self::variants($text, true) as $variant) {
            if (self::blaspHit($variant) !== null) {
                return true;
            }
        }

        return false;
    }

    /**
     * Проверить текст через Blasp с кириллическим граничным фильтром.
     *
     * Fail-open: при недоступности библиотеки возвращаем null и пишем
     * в лог — лучше пропустить, чем уронить публикацию всего сайта.
     *
     * @param  string  $text  текст для проверки (оригинал или канонизированный)
     * @return array{word: string}|null найденное слово
     */
    private static function blaspHit(string $text): ?array
    {
        if (trim($text) === '') {
            return null;
        }

        try {
            $result = Blasp::in(...self::BLASP_LANGUAGES)->check($text);
        } catch (\Throwable $error) {
            Log::warning('blasp check failed: '.$error->getMessage());

            return null;
        }

        if (! $result->isOffensive()) {
            return null;
        }

        foreach ($result->words() as $match) {
            $isReal = self::isRealMatch($text, $match->text, $match->position, $match->length);

            if ($isReal) {
                return ['word' => $match->base];
            }
        }

        return null;
    }

    /**
     * Отсечь ложные срабатывания внутри невинных кириллических слов.
     *
     * Байтовые \w-границы Blasp кириллицу не видят, поэтому «манда»
     * находится внутри «мандарина», а «хер» — внутри «Херсона».
     * Правило: совпадение с не-буквами внутри (м*дак, п-и-з-д-а, ху0й,
     * бл@дь) — всегда настоящее, в невинных словах масок не бывает.
     * Чисто буквенное совпадение — настоящее, только если слово целиком
     * является известным матом из языковых пакетов.
     *
     * @param  string  $text  проверяемый текст (тот же, что ушёл в Blasp)
     * @param  string  $matchedText  фрагмент совпадения из Blasp
     * @param  int  $position  позиция в символах
     * @param  int  $length  длина в символах
     * @return bool true когда совпадение настоящее
     */
    private static function isRealMatch(string $text, string $matchedText, int $position, int $length): bool
    {
        $hasObfuscation = preg_match('/[^\p{L}]/u', $matchedText) === 1;

        if ($hasObfuscation) {
            return true;
        }

        $core = mb_strtolower((string) preg_replace('/[^\p{L}]/u', '', $matchedText));
        $full = mb_strtolower(self::fullWordAt($text, $position, $length));

        if ($full === $core) {
            return true;
        }

        return isset(self::profanityWords()[$full]);
    }

    /**
     * Расширить совпадение до полного буквенного слова (юникод-границы).
     *
     * @param  string  $text  проверяемый текст
     * @param  int  $position  позиция совпадения в символах
     * @param  int  $length  длина совпадения в символах
     * @return string полное слово вокруг совпадения
     */
    private static function fullWordAt(string $text, int $position, int $length): string
    {
        $textLength = mb_strlen($text);
        $start = max(0, $position);
        $end = min($textLength, $position + $length);

        while ($start > 0 && preg_match('/\p{L}/u', (string) mb_substr($text, $start - 1, 1)) === 1) {
            $start--;
        }

        while ($end < $textLength && preg_match('/\p{L}/u', (string) mb_substr($text, $end, 1)) === 1) {
            $end++;
        }

        return (string) mb_substr($text, $start, $end - $start);
    }

    /**
     * Варианты написания текста для проверок (без дублей и пустых).
     *
     * [0] всегда lower-оригинал. Если есть латиница — добавляются транслит-копии:
     * визуальная (буквы-похожие: p → п), фонетическая с yu (shlyuha → шлюха)
     * и без него (xyu → хуй, т.к. yu там — это у+й, а не ю).
     * Цифровые вставки (ху0й) чистятся всегда, независимо от латиницы.
     * Чисто кириллические тексты без цифр проверяются один раз — быстро.
     *
     * @param  string  $text  исходный текст
     * @param  bool  $keepCase  оставить оригинал как есть (для Blasp: у него свой /iu)
     * @return list<string> уникальные варианты
     */
    private static function variants(string $text, bool $keepCase = false): array
    {
        $lowered = mb_strtolower(trim($text));

        if ($lowered === '') {
            return [];
        }

        $variants = [$keepCase ? trim($text) : $lowered];

        $hasLatin = preg_match('/[a-z]/', $lowered) === 1;
        $hasDigitInserts = preg_match('/\p{Cyrillic}[0-9]+\p{Cyrillic}/u', $lowered) === 1;

        if (! $hasLatin && ! $hasDigitInserts) {
            return $variants;
        }

        $visual = self::canonicalize($lowered, 'visual');
        $phoneticA = self::canonicalize($lowered, 'phonA');
        $phoneticB = self::canonicalize($lowered, 'phonB');

        foreach ([$visual, $phoneticA, $phoneticB] as $candidate) {
            $isNew = $candidate !== '' && ! in_array($candidate, $variants, true);

            if ($isNew) {
                $variants[] = $candidate;
            }
        }

        return $variants;
    }

    /**
     * Канонизировать текст: ё→е, латиница→кириллица, цифровые вставки вон.
     *
     * Режимы (u и y меняются ролями в разных словах, поэтому их несколько):
     * - visual: буквы-похожие (p → п, b → в) — ловит смешанный набор;
     * - phonA: как слышится (b → б, u → у, sh → ш, ya → я, yu → ю) —
     *   suka → сука, blyad → бляд, shlyuha → шлюха, huy → хуй;
     * - phonB: u и y наоборот (u → й, y → у, без yu/ya) — xyu → хуй.
     * Цифры между кириллическими буквами выкидываются везде (ху0й → хуй).
     * Оригинал не меняется — копии только для детекта.
     *
     * @param  string  $lowered  lower-текст
     * @param  string  $mode  visual|phonA|phonB
     * @return string канонизированный текст
     */
    public static function canonicalize(string $lowered, string $mode = 'visual'): string
    {
        $out = str_replace('ё', 'е', $lowered);

        if ($mode === 'phonA' || $mode === 'phonB') {
            $out = self::applyDigraphs($out, $mode);
            $out = strtr($out, self::phoneticMap($mode));
        } else {
            $out = strtr($out, self::translitMap());
        }

        $out = (string) preg_replace('/(\p{Cyrillic})[0-9]+(\p{Cyrillic})/u', '$1$2', $out);

        return trim($out);
    }

    /**
     * Применить диграфы транслита до побуквенной замены.
     *
     * @param  string  $text  lower-текст
     * @param  string  $mode  phonA (с ya/yu/yo) либо phonB (только шипящие)
     * @return string текст с заменёнными диграфами
     */
    private static function applyDigraphs(string $text, string $mode): string
    {
        $pairs = ['sch' => 'щ', 'sh' => 'ш', 'ch' => 'ч', 'zh' => 'ж', 'kh' => 'х'];

        if ($mode === 'phonA') {
            $pairs['ya'] = 'я';
            $pairs['yo'] = 'ё';
            $pairs['yu'] = 'ю';
        }

        return strtr($text, $pairs);
    }

    /**
     * Побуквенная фонетическая замена (после диграфов).
     *
     * @param  string  $mode  phonA (u → у) либо phonB (u → й, y → у)
     * @return array<string, string>
     */
    private static function phoneticMap(string $mode): array
    {
        $map = [
            'a' => 'а', 'b' => 'б', 'c' => 'с', 'd' => 'д', 'e' => 'е',
            'f' => 'ф', 'g' => 'г', 'h' => 'х', 'i' => 'и', 'j' => 'й',
            'k' => 'к', 'l' => 'л', 'm' => 'м', 'n' => 'н', 'o' => 'о',
            'p' => 'п', 'q' => 'к', 'r' => 'р', 's' => 'с', 't' => 'т',
            'v' => 'в', 'w' => 'в', 'x' => 'х', 'z' => 'з',
        ];

        if ($mode === 'phonB') {
            $map['u'] = 'й';
            $map['y'] = 'у';
        } else {
            $map['u'] = 'у';
            $map['y'] = 'й';
        }

        return $map;
    }

    /**
     * Латиница → кириллица для поимки транслита (suka → сука, xyu → хую).
     *
     * @return array<string, string>
     */
    private static function translitMap(): array
    {
        return [
            'a' => 'а', 'b' => 'в', 'c' => 'с', 'd' => 'д', 'e' => 'е',
            'f' => 'ф', 'g' => 'г', 'h' => 'х', 'i' => 'и', 'j' => 'й',
            'k' => 'к', 'l' => 'л', 'm' => 'м', 'n' => 'н', 'o' => 'о',
            'p' => 'п', 'q' => 'к', 'r' => 'р', 's' => 'с', 't' => 'т',
            'u' => 'и', 'v' => 'в', 'w' => 'ш', 'x' => 'х', 'y' => 'у', 'z' => 'з',
        ];
    }

    /**
     * Множество известных матерных слов из языковых пакетов Blasp.
     *
     * Нужно граничному фильтру: чисто буквенное совпадение внутри
     * более длинного слова засчитываем, только если слово целиком —
     * известный мат (сучка), а не невинное слово (мандарин, Херсон).
     *
     * @return array<string, true>
     */
    private static function profanityWords(): array
    {
        if (self::$profanityWords !== null) {
            return self::$profanityWords;
        }

        $words = [];

        foreach (['russian', 'english'] as $language) {
            $path = config_path('languages/'.$language.'.php');

            if (! is_readable($path)) {
                continue;
            }

            try {
                $pack = require $path;
            } catch (\Throwable) {
                continue;
            }

            if (! is_array($pack)) {
                continue;
            }

            $list = $pack['profanities'] ?? [];

            foreach (is_array($list) ? $list : [] as $word) {
                $clean = mb_strtolower(trim((string) $word));

                if ($clean !== '') {
                    $words[$clean] = true;
                }
            }
        }

        self::$profanityWords = $words;

        return $words;
    }
}
