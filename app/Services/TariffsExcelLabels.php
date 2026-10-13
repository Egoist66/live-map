<?php

namespace App\Services;

/**
 * Общий словарь Excel тарифов: заголовки и переводы кодов в человеческие слова.
 *
 * Один источник правды для выгрузки (Exports) и загрузки (Imports):
 * поменяли подпись здесь — обе стороны понимают друг друга.
 * Парсеры принимают и коды (ulove, credit_pack, once), и слова из файла
 * («Знакомства», «Пакет кредитов», «Один раз»), регистр не важен.
 */
class TariffsExcelLabels
{
    /**
     * Порядок тарифов в файле.
     *
     * @var list<string>
     */
    public const PLAN_ORDER = ['free', 'pro', 'premium', 'business'];

    /**
     * Заголовки листа «Тарифы».
     *
     * Цена одна для всех стран: месяц, год, неделя.
     *
     * @var list<string>
     */
    public const PLANS_HEADERS = [
        'ID тарифа',
        'Тариф',
        'Для кого',
        'Описание',
        'Месяц',
        'Год',
        'Неделя',
        'Статус цен',
    ];

    /**
     * Заголовки листа «Что входит».
     *
     * @var list<string>
     */
    public const FEATURES_HEADERS = [
        'Ключ',
        'Тариф',
        'Возможность',
        'Пояснение',
        'Показывается',
        'Порядок',
    ];

    /**
     * Заголовки листа «Витрина».
     *
     * Последняя колонка — служебный JSON с остатками payload
     * (кредиты в пакете и т.п.): не трогайте, нужен для полного
     * восстановления после удаления всего.
     *
     * @var list<string>
     */
    public const SHOWCASE_HEADERS = [
        'Ключ',
        'Товар',
        'Пояснение',
        'Где показывается',
        'Что это',
        'Цена',
        'Как часто платят',
        'Для Free',
        'Для PRO',
        'Для Premium',
        'Для Business',
        'В продаже',
        'Порядок',
        'Данные (JSON)',
    ];

    /**
     * Слова-пустышки в денежных клетках (все = null).
     *
     * @var list<string>
     */
    public const EMPTY_PRICE_WORDS = [
        '',
        '—',
        '-',
        'бесплатно',
        'нет',
        'как всем',
        'пока пусто',
        'n/a',
        'null',
    ];

    /**
     * Код аудитории → подпись.
     *
     * @return array<string, string>
     */
    public static function audienceMap(): array
    {
        return [
            'users' => 'Для всех',
            'organizations' => 'Для компаний',
        ];
    }

    /**
     * Код раздела → подпись.
     *
     * @return array<string, string>
     */
    public static function moduleMap(): array
    {
        return [
            'general' => 'Везде',
            'ulove' => 'Знакомства',
            'upin' => 'Карта',
            'uflow' => 'Лента',
            'districts' => 'Районы',
            'business' => 'Компании',
        ];
    }

    /**
     * Код вида → подпись.
     *
     * @return array<string, string>
     */
    public static function kindMap(): array
    {
        return [
            'credit_pack' => 'Пакет кредитов',
            'ad' => 'Реклама',
            'feature' => 'Возможность тарифа',
        ];
    }

    /**
     * Код периода → подпись.
     *
     * @return array<string, string>
     */
    public static function periodMap(): array
    {
        return [
            'once' => 'Один раз',
            'week' => 'Каждую неделю',
            'month' => 'Каждый месяц',
            'year' => 'Сразу за год',
        ];
    }

    /**
     * Нормализовать строку для сравнений: нижний регистр + trim + ё→е.
     *
     * @param mixed $value сырое значение клетки
     */
    public static function norm(mixed $value): string
    {
        $text = trim((string) ($value ?? ''));
        $text = mb_strtolower($text);

        return str_replace('ё', 'е', $text);
    }

    /**
     * Тариф по слову из файла: принимает id и название.
     *
     * @param mixed $value клетка «Тариф»
     * @param array<string, string> $planNames id → живое название
     */
    public static function parsePlan(mixed $value, array $planNames = []): ?string
    {
        $norm = self::norm($value);

        if ($norm === '') {
            return null;
        }

        foreach (self::PLAN_ORDER as $id) {
            if ($norm === $id) {
                return $id;
            }
        }

        foreach ($planNames as $id => $name) {
            if ($norm === self::norm($name)) {
                return $id;
            }
        }

        $aliases = [
            'про' => 'pro',
            'премиум' => 'premium',
            'бизнес' => 'business',
            'фри' => 'free',
            'бесплатный' => 'free',
        ];

        return $aliases[$norm] ?? null;
    }

    /**
     * Аудитория по слову из файла.
     *
     * @param mixed $value клетка «Для кого»
     */
    public static function parseAudience(mixed $value): string
    {
        $norm = self::norm($value);

        foreach (self::audienceMap() as $code => $label) {
            if ($norm === $code || $norm === self::norm($label)) {
                return $code;
            }
        }

        return $norm === self::norm('Для компаний') ? 'organizations' : 'users';
    }

    /**
     * Раздел по слову из файла (код или подпись).
     *
     * @param mixed $value клетка «Где показывается»
     */
    public static function parseModule(mixed $value): string
    {
        $norm = self::norm($value);

        if ($norm === '' || $norm === 'общее') {
            return 'general';
        }

        foreach (self::moduleMap() as $code => $label) {
            if ($norm === $code || $norm === self::norm($label)) {
                return $code;
            }
        }

        return 'general';
    }

    /**
     * Вид по слову из файла.
     *
     * @param mixed $value клетка «Что это»
     */
    public static function parseKind(mixed $value): string
    {
        $norm = self::norm($value);

        foreach (self::kindMap() as $code => $label) {
            if ($norm === $code || $norm === self::norm($label)) {
                return $code;
            }
        }

        if ($norm === 'товар') {
            return 'credit_pack';
        }

        return 'credit_pack';
    }

    /**
     * Период по слову из файла.
     *
     * @param mixed $value клетка «Как часто платят»
     */
    public static function parsePeriod(mixed $value): string
    {
        $norm = self::norm($value);

        foreach (self::periodMap() as $code => $label) {
            if ($norm === $code || $norm === self::norm($label)) {
                return $code;
            }
        }

        $aliases = [
            'разово' => 'once',
            'разовая' => 'once',
            '/ нед' => 'week',
            '/ мес' => 'month',
            '/ год' => 'year',
        ];

        return $aliases[$norm] ?? 'once';
    }

    /**
     * Признак «да/нет» по слову из файла.
     *
     * @param mixed $value клетка «Показывается» / «В продаже»
     * @param bool $default если клетка пустая
     */
    public static function parseActive(mixed $value, bool $default = true): bool
    {
        $norm = self::norm($value);

        if ($norm === '') {
            return $default;
        }

        $truthy = ['да', 'д', 'yes', 'y', '1', 'true', 'показывается', 'в продаже', 'видна', 'видно', '+'];
        $falsy = ['нет', 'н', 'no', 'n', '0', 'false', 'скрыта', 'скрыт', 'не продается', 'не продаеться', '-', '—'];

        if (in_array($norm, $truthy, true)) {
            return true;
        }

        if (in_array($norm, $falsy, true)) {
            return false;
        }

        return $default;
    }

    /**
     * Деньги по клетке: число либо null для слов-пустышек.
     *
     * Принимает числа, строки с $ и запятыми, слова из EMPTY_PRICE_WORDS.
     *
     * @param mixed $value клетка с ценой
     */
    public static function parsePrice(mixed $value): ?float
    {
        if ($value === null) {
            return null;
        }

        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }

        $text = trim((string) $value);

        if ($text === '') {
            return null;
        }

        if (in_array(self::norm($text), self::EMPTY_PRICE_WORDS, true)) {
            return null;
        }

        $cleaned = str_replace(['$', '€', '₽', ' '], '', $text);
        $cleaned = str_replace(',', '.', $cleaned);

        if (! is_numeric($cleaned)) {
            return null;
        }

        $price = (float) $cleaned;

        if ($price < 0 || $price > 9999) {
            return null;
        }

        return $price;
    }

    /**
     * Порядок по клетке: целое 0..100000, иначе null.
     *
     * @param mixed $value клетка «Порядок»
     */
    public static function parseSortOrder(mixed $value): ?int
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        if (! is_numeric((string) $value)) {
            return null;
        }

        $order = (int) $value;

        if ($order < 0 || $order > 100000) {
            return null;
        }

        return $order;
    }

    /**
     * Ключ для новой строки: транслит названия как на фронте.
     *
     * @param string $name название товара или возможности
     * @param string $prefix префикс при пустом названии
     */
    public static function slugify(string $name, string $prefix = 'item'): string
    {
        $map = [
            'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd',
            'е' => 'e', 'ё' => 'yo', 'ж' => 'zh', 'з' => 'z', 'и' => 'i',
            'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n',
            'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't',
            'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'ts', 'ч' => 'ch',
            'ш' => 'sh', 'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '',
            'э' => 'e', 'ю' => 'yu', 'я' => 'ya',
        ];

        $lower = mb_strtolower(trim($name));
        $chars = preg_split('//u', $lower, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $latin = '';

        foreach ($chars as $char) {
            $latin .= $map[$char] ?? $char;
        }

        $slug = (string) preg_replace('/[^a-z0-9]+/', '_', $latin);
        $slug = trim($slug, '_');

        if (strlen($slug) > 40) {
            $slug = substr($slug, 0, 40);
        }

        $slug = trim($slug, '_');

        return $slug === '' ? $prefix : $slug;
    }
}
