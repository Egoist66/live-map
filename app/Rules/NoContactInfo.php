<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Правило «без никнеймов и ссылок на соцсети» для анкеты и профиля.
 *
 * Ловит контакты, которые пользователи пытаются протащить в свободный
 * текст: ссылки и домены (t.me, vk.com, instagram), e-mail, @никнеймы,
 * телефоны и конструкции вида «тг: nick» / «инста — nick». Проверка
 * локальная, без сети и ИИ, поэтому срабатывает мгновенно и одинаково
 * на бэкенде и во фронтовом зеркале (resources/js/utils/contactInfo.ts).
 *
 * @example
 * use App\Rules\NoContactInfo;
 *
 * public function rules(): array
 * {
 *     return [
 *         'dating_about' => ['nullable', 'string', 'max:1000', new NoContactInfo()],
 *     ];
 * }
 */
class NoContactInfo implements ValidationRule
{
    /**
     * Единое сообщение об ошибке для всех полей анкеты.
     *
     * @var string
     */
    public const MESSAGE = 'Никнеймы и ссылки на соцсети в анкете запрещены — общайтесь внутри сервиса.';

    /**
     * Названия соцсетей и мессенджеров, после которых обычно идёт ник.
     *
     * @var list<string>
     */
    private const SOCIAL_KEYWORDS = [
        'телеграм', 'телеграмм', 'телега', 'тг', 'tg', 'telegram',
        'инстаграм', 'инстаграмм', 'инста', 'инст', 'insta', 'instagram', 'ig',
        'вконтакте', 'вк', 'vk', 'vkontakte',
        'ватсап', 'вотсап', 'whatsapp', 'вайбер', 'viber',
        'дискорд', 'discord', 'скайп', 'skype',
        'снапчат', 'snapchat', 'тикток', 'tiktok',
        'твиттер', 'twitter', 'фейсбук', 'facebook',
        'тредс', 'threads', 'линкедин', 'linkedin', 'твич', 'twitch',
        'ютуб', 'youtube', 'onlyfans', 'boosty', 'patreon',
    ];

    /**
     * Слова, которые явно вводят никнейм или логин.
     *
     * @var list<string>
     */
    private const NICKNAME_KEYWORDS = [
        'ник', 'никнейм', 'nick', 'nickname', 'username', 'юзернейм', 'логин', 'login',
    ];

    /**
     * Популярные TLD: по ним узнаём домен даже без схемы http://.
     *
     * @var string
     */
    private const TLD_PATTERN = 'com|ru|net|org|me|io|tv|cc|link|site|app|xyz|info|biz|pro|online|store|club|live|gg|ly|to|by|kz|ua|de|uk|fr|es|it|us|co';

    /**
     * Проверить значение на контакты и ссылки.
     *
     * @param string $attribute имя поля
     * @param mixed $value значение поля
     * @param Closure $fail callback ошибки валидации
     * @return void
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || trim($value) === '') {
            return;
        }

        if (self::containsContactInfo($value)) {
            $fail(self::MESSAGE);
        }
    }

    /**
     * Найти в тексте никнейм, соцсеть или другой контакт.
     *
     * @param string $text проверяемый текст
     * @return bool true если найден контакт
     */
    public static function containsContactInfo(string $text): bool
    {
        $text = mb_strtolower(trim($text));

        if ($text === '') {
            return false;
        }

        $probe = self::normalizeObfuscation($text);

        if (preg_match('~https?://|www\.~iu', $probe) === 1) {
            return true;
        }

        if (preg_match('~[\p{L}0-9._%+-]+@[\p{L}0-9.-]+\.[\p{L}]{2,}~iu', $probe) === 1) {
            return true;
        }

        if (preg_match('~(?:^|[\s(])@[\p{L}0-9_][\p{L}0-9_.]{2,}~iu', $probe) === 1) {
            return true;
        }

        $domainPattern = '~\b(?:[a-z0-9-]+\.)+(?:'.self::TLD_PATTERN.')\b~iu';

        if (preg_match($domainPattern, $probe) === 1) {
            return true;
        }

        if (self::hasSocialKeywordWithHandle($probe)) {
            return true;
        }

        if (self::hasPhone($probe)) {
            return true;
        }

        return false;
    }

    /**
     * Привести обфускацию ссылок к простому виду.
     *
     * «t[.]me», «t (dot) me», «t . me» и «t / me» становятся «t.me» /
     * «t/me», чтобы доменный шаблон их увидел.
     *
     * @param string $text lower-текст
     * @return string нормализованная копия для проверки
     */
    private static function normalizeObfuscation(string $text): string
    {
        $probe = preg_replace('~\s*[\[({]\s*(?:dot|точка)\s*[\])}]\s*~iu', '.', $text) ?? $text;
        $probe = preg_replace('~\s*\.\s*~u', '.', $probe) ?? $probe;

        return preg_replace('~\s*/\s*~u', '/', $probe) ?? $probe;
    }

    /**
     * Найти пару «соцсеть/ник + значение»: «тг: nick», «инста — nick», «@nick».
     *
     * @param string $text нормализованный lower-текст
     * @return bool true если найдена связка
     */
    private static function hasSocialKeywordWithHandle(string $text): bool
    {
        $keywords = array_merge(self::SOCIAL_KEYWORDS, self::NICKNAME_KEYWORDS);
        $alternation = implode('|', array_map(
            static fn (string $keyword): string => preg_quote($keyword, '~'),
            $keywords,
        ));
        $keywordPattern = '(?<![\p{L}])('.$alternation.')(?![\p{L}])';
        $handlePattern = '@?[\p{L}0-9_][\p{L}0-9_.]{1,}';

        if (preg_match('~'.$keywordPattern.'\s*(?:[:\-–—]\s*|@\s*)'.$handlePattern.'~iu', $text) === 1) {
            return true;
        }

        if (preg_match('~'.$keywordPattern.'\s+@'.$handlePattern.'~iu', $text) === 1) {
            return true;
        }

        $latinHandlePattern = '(?=[\p{L}0-9_.]*[a-z0-9_])'.$handlePattern;

        return preg_match('~'.$keywordPattern.'\s+'.$latinHandlePattern.'~iu', $text) === 1;
    }

    /**
     * Найти телефонный номер.
     *
     * @param string $text нормализованный lower-текст
     * @return bool true если найден номер из 10–15 цифр
     */
    private static function hasPhone(string $text): bool
    {
        $pattern = '~(?<!\d)(?:\+\d[\d\s()\-]{7,}\d|8[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})(?!\d)~u';

        if (preg_match_all($pattern, $text, $matches) === 0) {
            return false;
        }

        foreach ($matches[0] as $candidate) {
            $digits = preg_replace('/\D+/', '', $candidate) ?? '';
            $length = mb_strlen($digits);

            if ($length >= 10 && $length <= 15) {
                return true;
            }
        }

        return false;
    }
}
