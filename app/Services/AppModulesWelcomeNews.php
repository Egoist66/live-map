<?php

namespace App\Services;

use App\Models\AppUpdate;
use App\Models\User;
use App\Notifications\AppPublishedNotification;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Системная новость-гид по разделам приложения.
 *
 * Пока выпущен только ULove — новость рассказывает о знакомствах:
 * свайпы, мэтчи, чат и где что настраивается. По мере выпуска
 * разделов текст обновляется новой версией (VERSION): старая
 * запись при этом снимается с публикации, чтобы в «Новостях»
 * не висели упоминания невыпущенного.
 *
 * Новость лежит в колокольчике (таб «Новости» + модалка «Что нового»)
 * и подсказывает, где включается остальное: Настройки → Приложение
 * → «Разделы приложения».
 *
 * Выдача строго однократная: нажал «Понятно» (или «Прочитать все»,
 * или вычистил ленту корзиной) — флаг dismissed пишется в settings
 * пользователя и новость больше не создаётся, даже если inbox-строка
 * удалена. Решение админа тоже уважается: снятие с публикации
 * прячет гид, удаление из админки — хоронит его через retired-флаг,
 * автопересоздания больше нет.
 */
class AppModulesWelcomeNews
{
    /**
     * Маркер версии гида: по нему находим запись без миграций.
     */
    public const VERSION = 'modules-guide-v2';

    /**
     * Заголовок новости в колокольчике.
     */
    public const TITLE = 'ULove: короткий гид по знакомствам';

    /**
     * Текст новости: как устроены знакомства и где что включается.
     */
    public const BODY = "ULove — это знакомства рядом. Листай анкеты людей поблизости, ставь лайк или пас, а взаимный лайк открывает мэтч и чат.\n\n"
        . "Как всё устроено:\n"
        . "1. Свайпы — листай ленту и отмечай, кто понравился.\n"
        . "2. Мэтч — взаимный лайк открывает direct-чат.\n"
        . "3. Суперлайк (синяя звезда) — выдели анкету, тебя заметят первым.\n\n"
        . "Где что настраивается:\n"
        . "1. Открой Настройки → Приложение → «Разделы приложения».\n"
        . "2. Звезда ★ — какой раздел открывать после входа.\n\n"
        . "Ничего переустанавливать не нужно. Новые функции всегда ищи в колокольчике → таб «Новости».";

    /**
     * Найти или создать опубликованную новость-гид.
     *
     * Старые версии гида снимаем с публикации: в «Новостях» должна
     * лежать только актуальная, без упоминаний невыпущенных разделов.
     * Существующую запись текущей версии не трогаем: снятие с публикации
     * в админке остаётся в силе, дубли не плодятся. Похороненный гид
     * (retired) не воскрешаем — возвращается null.
     *
     * @return AppUpdate|null запись гида или null, когда похоронен
     */
    public static function ensurePublished(): ?AppUpdate
    {
        if (self::isRetired()) {
            return null;
        }

        $stale = AppUpdate::where('version', 'like', 'modules-guide-%')
            ->where('version', '!=', self::VERSION)
            ->where('is_published', true);

        $stale->update(['is_published' => false]);

        $existing = AppUpdate::where('version', self::VERSION)
            ->latest('id')
            ->first();

        if ($existing) {
            return $existing;
        }

        return AppUpdate::create([
            'title' => self::TITLE,
            'body' => self::BODY,
            'version' => self::VERSION,
            'is_published' => true,
            'published_at' => now(),
            'created_by' => null,
        ]);
    }

    /**
     * Похоронен ли гид решением админа (удалён из админки).
     *
     * @return bool true — не создавать и не досылать никому
     */
    public static function isRetired(): bool
    {
        try {
            return AppSettings::get('guides.'.self::VERSION.'.retired', '0') === '1';
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Похоронить гид: удаление из админки больше не воскресает.
     */
    public static function retire(): void
    {
        AppSettings::set('guides.'.self::VERSION.'.retired', '1');
    }

    /**
     * Вернуть гид в строй: админ вручную публикует запись той же версии.
     */
    public static function unretire(): void
    {
        AppSettings::set('guides.'.self::VERSION.'.retired', '0');
    }

    /**
     * Это ли запись нашего гида.
     *
     * @param AppUpdate $update проверяемая новость
     * @return bool true для текущей версии гида
     */
    public static function isGuideUpdate(AppUpdate $update): bool
    {
        return (string) $update->version === self::VERSION;
    }

    /**
     * Отмахнулся ли пользователь от гида («Понятно» / «Прочитать все» / корзина).
     *
     * @param User $user проверяемый
     * @return bool true — больше не досылать
     */
    public static function isDismissed(User $user): bool
    {
        try {
            $settings = $user->settings ?? [];
            $dismissed = $settings['guides_dismissed'] ?? [];
        } catch (\Throwable) {
            return false;
        }

        if (! is_array($dismissed)) {
            return false;
        }

        return in_array(self::VERSION, $dismissed, true);
    }

    /**
     * Запомнить отказ от гида навсегда (переживает чистку ленты).
     *
     * @param User $user пользователь
     */
    public static function dismissFor(User $user): void
    {
        self::dismissVersionFor($user, self::VERSION);
    }

    /**
     * Запомнить отказ от конкретной версии гида навсегда.
     *
     * markRead зовёт с версией из inbox-пейлоада: старую версию
     * (v1 после бампа на v2) тоже надо гасить, иначе её непрочитанная
     * строка останется вечной — отметить прочитанной её больше нечем.
     *
     * @param User $user пользователь
     * @param string $version версия гида (modules-guide-*)
     */
    public static function dismissVersionFor(User $user, string $version): void
    {
        try {
            $settings = $user->settings ?? [];

            if (! is_array($settings)) {
                $settings = [];
            }

            $dismissed = $settings['guides_dismissed'] ?? [];

            if (! is_array($dismissed)) {
                $dismissed = [];
            }

            if (in_array($version, $dismissed, true)) {
                return;
            }

            $dismissed[] = $version;
            $settings['guides_dismissed'] = array_values($dismissed);
            $user->settings = $settings;
            $user->save();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('guide dismiss failed', [
                'user_id' => $user->getKey() ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Есть ли у пользователя живая строка гида в inbox.
     *
     * @param User $user владелец ленты
     * @return bool true — строка с ключом app:{id гида} на месте
     */
    public static function hasGuideRow(User $user): bool
    {
        try {
            $guideId = self::publishedGuideId();

            if (! $guideId) {
                return false;
            }

            return DatabaseNotification::where('notifiable_type', $user->getMorphClass())
                ->where('notifiable_id', $user->getKey())
                ->where('type', 'app.published')
                ->where('key', 'app:'.$guideId)
                ->exists();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Отметить отказ, если среди прочитанных id была строка гида.
     *
     * @param User $user владелец ленты
     * @param string[] $ids прочитанные id строк
     */
    public static function dismissIfGuideRead(User $user, array $ids): void
    {
        try {
            $guideId = self::publishedGuideId();

            if (! $guideId || $ids === []) {
                return;
            }

            $touched = DatabaseNotification::where('notifiable_type', $user->getMorphClass())
                ->where('notifiable_id', $user->getKey())
                ->where('type', 'app.published')
                ->where('key', 'app:'.$guideId)
                ->whereIn('id', array_values(array_map('strval', $ids)))
                ->exists();

            if ($touched) {
                self::dismissFor($user);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('guide dismiss check failed', [
                'user_id' => $user->getKey() ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Id опубликованной записи гида (без автопересоздания).
     *
     * @return int|null id или null, когда гида нет / снят / похоронен
     */
    public static function publishedGuideId(): ?int
    {
        try {
            if (self::isRetired()) {
                return null;
            }

            $id = AppUpdate::where('version', self::VERSION)
                ->where('is_published', true)
                ->latest('id')
                ->value('id');

            return $id ? (int) $id : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Досыпать гид пользователю, если положено. Выдача однократная.
     *
     * Кому не шлём: админам, отказавшимся (dismissed), всем —
     * когда гид похоронен или снят с публикации. У кого строка уже
     * есть (прочитана или нет) — ничего не досылаем.
     *
     * @param \App\Models\User $user получатель
     * @return void
     */
    public static function ensureDelivered($user): void
    {
        try {
            if (! $user || ! $user->getKey()) {
                return;
            }

            if (! empty($user->is_admin) || ($user->role ?? null) === 'admin') {
                return;
            }

            if ($user instanceof User && self::isDismissed($user)) {
                return;
            }

            $update = self::ensurePublished();

            if (! $update || ! $update->is_published) {
                return;
            }

            $morph = $user->getMorphClass();
            $userId = $user->getKey();
            $key = 'app:'.$update->id;

            $hasByKey = DatabaseNotification::where('notifiable_type', $morph)
                ->where('notifiable_id', $userId)
                ->where('type', 'app.published')
                ->where('key', $key)
                ->exists();

            if ($hasByKey) {
                return;
            }

            $hasLegacy = DatabaseNotification::where('notifiable_type', $morph)
                ->where('notifiable_id', $userId)
                ->where('type', 'app.published')
                ->where('data->update_id', $update->id)
                ->exists();

            if ($hasLegacy) {
                return;
            }

            UserNotifier::send($user, new AppPublishedNotification($update));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('modules welcome news failed', [
                'user_id' => $user->getKey() ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
