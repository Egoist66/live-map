<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Антифлуд для публичного контента: дубликаты, темп, капс и ссылки.
 *
 * Blasp ловит только мат, а флуд (одно и то же сообщение пачкой, КАПС,
 * простыни ссылок) — поведенческий. Поэтому отдельный сервис поверх
 * rate-лимитеров из роутов (throttle:comments-write и др. режут частоту,
 * FloodGuard — содержание).
 *
 * Использование — две точки:
 * 1) assertNotFlooding() в начале store() — 422 при нарушении;
 * 2) remember() после успешного сохранения — запомнить текст и время.
 *
 * @example
 * public function store(StoreCommentRequest $request, FloodGuard $guard)
 * {
 *     $guard->assertNotFlooding($request->user(), $request->string('comment_text'));
 *     $comment = Comment::create([...]);
 *     $guard->remember($request->user(), $request->string('comment_text'));
 * }
 */
class FloodGuard
{
    /**
     * Минимальная пауза между публикациями одного юзера, секунд.
     */
    public const MIN_INTERVAL_SECONDS = 10;

    /**
     * Окно поиска дубликата, секунд (повтор того же текста).
     */
    public const DUPLICATE_WINDOW_SECONDS = 600;

    /**
     * Доля заглавных букв, выше которой текст считается КАПС-флудом.
     */
    public const CAPS_RATIO = 0.7;

    /**
     * Минимальная длина для проверки на КАПС (короткие не трогаем).
     */
    public const CAPS_MIN_LENGTH = 12;

    /**
     * Сколько ссылок в тексте уже считается спамом.
     */
    public const MAX_LINKS = 3;

    /**
     * Проверить текст и бросить 422 при флуде.
     *
     * Персонал (`canModerate`) не ограничивается — как и в assertClean.
     * Порядок — от дешёвого к дорогому: капс/ссылки (без сети и кэша),
     * затем темп и дубликат по кэшу.
     *
     * @param User $user автор текста
     * @param string|null $text проверяемый текст
     * @param string $context контекст (comment, post, review) — раздельные окна
     */
    public function assertNotFlooding(User $user, ?string $text, string $context = 'comment'): void
    {
        if ($user->canModerate()) {
            return;
        }

        $clean = trim((string) $text);

        if ($clean === '') {
            return;
        }

        $this->assertNoCapsSpam($clean);
        $this->assertNoLinkSpam($clean);
        $this->assertInterval($user, $context);
        $this->assertNoDuplicate($user, $clean, $context);
    }

    /**
     * Запомнить успешную публикацию (текст-хэш и время).
     *
     * @param  User  $user  автор текста
     * @param  string|null  $text  сохранённый текст
     * @param  string  $context  контекст (тот же, что в assertNotFlooding)
     */
    public function remember(User $user, ?string $text, string $context = 'comment'): void
    {
        $clean = trim((string) $text);

        if ($clean === '') {
            return;
        }

        $fingerprint = $this->fingerprint($clean);

        Cache::put($this->hashKey($user, $context), $fingerprint, self::DUPLICATE_WINDOW_SECONDS);
        Cache::put($this->timeKey($user, $context), time(), self::DUPLICATE_WINDOW_SECONDS);
    }

    /**
     * Отклонить КАПС-флуд («КУПИТЕ ПРЯМО СЕЙЧАС!!!»).
     *
     * @param  string  $text  проверяемый текст
     */
    private function assertNoCapsSpam(string $text): void
    {
        $letters = (string) preg_replace('/[^\p{Lu}\p{Ll}]/u', '', $text);
        $letterCount = mb_strlen($letters);

        if ($letterCount < self::CAPS_MIN_LENGTH) {
            return;
        }

        $upperCount = mb_strlen((string) preg_replace('/[^\p{Lu}]/u', '', $text));
        $ratio = $upperCount / $letterCount;

        if ($ratio >= self::CAPS_RATIO) {
            abort(422, 'Выключите Caps Lock — сообщение из одних заглавных букв похоже на флуд.');
        }
    }

    /**
     * Отклонить спам ссылками (больше MAX_LINKS в одном тексте).
     *
     * @param  string  $text  проверяемый текст
     */
    private function assertNoLinkSpam(string $text): void
    {
        $linkCount = preg_match_all('/https?:\/\/|www\.|t\.me\/|@[a-z0-9_]{3,}/iu', $text);

        if ($linkCount > self::MAX_LINKS) {
            abort(422, 'Слишком много ссылок в одном сообщении — похоже на спам.');
        }
    }

    /**
     * Отклонить слишком частые публикации (минимальная пауза).
     *
     * @param  User  $user  автор текста
     * @param  string  $context  контекст окна
     */
    private function assertInterval(User $user, string $context): void
    {
        $lastAt = Cache::get($this->timeKey($user, $context));

        if (! is_int($lastAt)) {
            return;
        }

        $elapsed = time() - $lastAt;
        $isTooFast = $elapsed < self::MIN_INTERVAL_SECONDS;

        if ($isTooFast) {
            $wait = self::MIN_INTERVAL_SECONDS - $elapsed;

            abort(422, "Подождите {$wait} сек. перед следующим сообщением.");
        }
    }

    /**
     * Отклонить повтор того же текста в окне (классический флуд).
     *
     * Сравнение по отпечатку: lower + схлопнутые пробелы, чтобы повтор
     * с лишним пробелом тоже ловился.
     *
     * @param  User  $user  автор текста
     * @param  string  $text  проверяемый текст
     * @param  string  $context  контекст окна
     */
    private function assertNoDuplicate(User $user, string $text, string $context): void
    {
        $lastHash = Cache::get($this->hashKey($user, $context));

        if (! is_string($lastHash)) {
            return;
        }

        $isDuplicate = hash_equals($lastHash, $this->fingerprint($text));

        if ($isDuplicate) {
            abort(422, 'Пожалуйста, не флудите одинаковыми сообщениями.');
        }
    }

    /**
     * Отпечаток текста для сравнения дубликатов.
     *
     * @param  string  $text  проверяемый текст
     * @return string sha1-хэш нормализованного текста
     */
    private function fingerprint(string $text): string
    {
        $normalized = mb_strtolower(trim($text));
        $normalized = (string) preg_replace('/\s+/u', ' ', $normalized);

        return sha1($normalized);
    }

    /**
     * Ключ кэша последнего хэша текста.
     *
     * @param  User  $user  автор текста
     * @param  string  $context  контекст окна
     * @return string ключ кэша
     */
    private function hashKey(User $user, string $context): string
    {
        return "flood:hash:{$context}:".$user->getKey();
    }

    /**
     * Ключ кэша времени последней публикации.
     *
     * @param  User  $user  автор текста
     * @param  string  $context  контекст окна
     * @return string ключ кэша
     */
    private function timeKey(User $user, string $context): string
    {
        return "flood:time:{$context}:".$user->getKey();
    }
}
