<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;

/**
 * Слаг профиля пользователя для красивых URL без id.
 *
 * Генерирует уникальный `profile_slug` из отображаемого имени
 * (собственный транслит кириллицы, нижний регистр, слова через дефис —
 * «Анна Иванова» превращается в `anna-ivanova`) и резолвит
 * пользователя по слагу либо по числовому id для обратной
 * совместимости со старыми ссылками `/users/123`.
 *
 * Правила:
 * - слаг никогда не чисто числовой (иначе неотличим от id);
 * - пустое/числовое имя даёт детерминированный `user-{id}`;
 * - дубли получают суффикс `-2`, `-3` и так далее.
 */
class ProfileSlugService
{
    /**
     * Максимальная длина базовой части слага.
     */
    private const MAX_BASE_LENGTH = 100;

    /**
     * Базовый слаг из имени без проверки уникальности.
     *
     * Кириллица транслитерируется собственной картой (на серверах
     * без ext-intl `Str::slug` её молча выкидывает и даёт пустой
     * слаг). «Анна Иванова» превращается в `anna-ivanova`.
     *
     * @param string $name отображаемое имя пользователя
     * @return string транслитерированный слаг или пустая строка
     */
    public function baseSlug(string $name): string
    {
        $latin = $this->transliterate(trim($name));

        $slug = Str::slug($latin);

        if (mb_strlen($slug) > self::MAX_BASE_LENGTH) {
            $slug = mb_substr($slug, 0, self::MAX_BASE_LENGTH);
        }

        return rtrim($slug, '-');
    }

    /**
     * Транслитерация кириллицы в латиницу для слагов.
     *
     * Собственная карта вместо intl/iconv: результат не зависит
     * от установленных расширений и локали сервера, одинаков
     * в dev и prod. Остальное (регистр, пробелы, пунктуация)
     * добивает `Str::slug`.
     *
     * @param string $value строка с возможной кириллицей
     * @return string строка латиницей
     */
    private function transliterate(string $value): string
    {
        $map = [
            'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd',
            'е' => 'e', 'ё' => 'yo', 'ж' => 'zh', 'з' => 'z', 'и' => 'i',
            'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n',
            'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't',
            'у' => 'u', 'ф' => 'f', 'х' => 'kh', 'ц' => 'ts', 'ч' => 'ch',
            'ш' => 'sh', 'щ' => 'shch', 'ъ' => '', 'ы' => 'y', 'ь' => '',
            'э' => 'e', 'ю' => 'yu', 'я' => 'ya',
            'А' => 'A', 'Б' => 'B', 'В' => 'V', 'Г' => 'G', 'Д' => 'D',
            'Е' => 'E', 'Ё' => 'Yo', 'Ж' => 'Zh', 'З' => 'Z', 'И' => 'I',
            'Й' => 'Y', 'К' => 'K', 'Л' => 'L', 'М' => 'M', 'Н' => 'N',
            'О' => 'O', 'П' => 'P', 'Р' => 'R', 'С' => 'S', 'Т' => 'T',
            'У' => 'U', 'Ф' => 'F', 'Х' => 'Kh', 'Ц' => 'Ts', 'Ч' => 'Ch',
            'Ш' => 'Sh', 'Щ' => 'Shch', 'Ъ' => '', 'Ы' => 'Y', 'Ь' => '',
            'Э' => 'E', 'Ю' => 'Yu', 'Я' => 'Ya',
        ];

        return strtr($value, $map);
    }

    /**
     * Уникальный слаг для имени с учётом занятых.
     *
     * @param string $name отображаемое имя пользователя
     * @param int|null $ignoreId id пользователя, чей слаг не считать занятым
     * @return string уникальный слаг (никогда не чисто числовой)
     */
    public function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = $this->baseSlug($name);

        $isUsableBase = $base !== '' && !ctype_digit($base);

        $candidate = $isUsableBase ? $base : $this->fallbackSlug($ignoreId);

        $suffix = 2;

        while ($this->isTaken($candidate, $ignoreId)) {
            $candidate = $isUsableBase
                ? "{$base}-{$suffix}"
                : $this->fallbackSlug($ignoreId, $suffix);

            $suffix++;
        }

        return $candidate;
    }

    /**
     * Слаг пользователя: сохранённый или свежесгенерированный (без записи).
     *
     * @param User $user пользователь
     * @return string текущий либо новый уникальный слаг
     */
    public function ensureSlug(User $user): string
    {
        $stored = trim((string) ($user->profile_slug ?? ''));

        if ($stored !== '') {
            return $stored;
        }

        $id = $user->exists ? (int) $user->id : null;

        return $this->uniqueSlug((string) ($user->name ?? ''), $id);
    }

    /**
     * Найти пользователя по идентификатору из URL.
     *
     * Числовой идентификатор ищется по id (старые ссылки `/users/123`),
     * остальное — по `profile_slug`.
     *
     * @param string $identifier слаг или числовой id из URL
     * @return User|null пользователь или null
     */
    public function resolve(string $identifier): ?User
    {
        $clean = trim($identifier);

        if ($clean === '') {
            return null;
        }

        if (ctype_digit($clean)) {
            return User::find((int) $clean);
        }

        return User::where('profile_slug', mb_strtolower($clean))->first();
    }

    /**
     * Канонический URL профиля со слагом.
     *
     * @param User $user пользователь
     * @param bool $absolute вернуть абсолютный URL
     * @return string относительный либо абсолютный URL профиля
     */
    public function canonicalUrl(User $user, bool $absolute = false): string
    {
        $slug = trim((string) ($user->profile_slug ?? ''));

        $identifier = $slug !== '' ? $slug : (int) $user->id;

        return route('users.show', ['profile' => $identifier], $absolute);
    }

    /**
     * Запасной слаг когда из имени слаг не строится.
     *
     * @param int|null $userId id пользователя для детерминированного фолбэка
     * @param int|null $suffix числовой суффикс при коллизии
     * @return string `user-{id}` либо `user[-{suffix}]`
     */
    private function fallbackSlug(?int $userId, ?int $suffix = null): string
    {
        if ($userId !== null) {
            return $suffix === null ? "user-{$userId}" : "user-{$userId}-{$suffix}";
        }

        return $suffix === null ? 'user' : "user-{$suffix}";
    }

    /**
     * Проверить, занят ли слаг другим пользователем.
     *
     * @param string $slug проверяемый слаг
     * @param int|null $ignoreId id пользователя, которого не учитывать
     * @return bool true когда слаг уже используется
     */
    private function isTaken(string $slug, ?int $ignoreId): bool
    {
        $query = User::where('profile_slug', $slug);

        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }

        return $query->exists();
    }
}
