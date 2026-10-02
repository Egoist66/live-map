<?php

namespace App\Services;

use App\Models\SavedNote;
use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Бизнес-логика «Избранного» (заметки только для себя).
 *
 * Контроллер остаётся тонким: валидация и HTTP — в нём, поиск по
 * расшифрованным телам, пагинация и режим хранения — здесь. Поиск идёт
 * в PHP по расшифровкам (тела зашифрованы — индекс по тексту невозможен),
 * выбираем не более SEARCH_SCAN_LIMIT свежих и режем страницу вручную.
 */
class SavedNotesService
{
    /**
     * Сколько свежих заметок сканируем при поиске (защита от перебора всей таблицы).
     */
    public const SEARCH_SCAN_LIMIT = 500;

    /**
     * Размер страницы по умолчанию.
     */
    public const PER_PAGE = 20;

    /**
     * Допустимые режимы хранения.
     *
     * @var string[]
     */
    public const STORAGE_MODES = ['server', 'local'];

    /**
     * Список заметок с поиском и пагинацией.
     *
     * @param User $user владелец
     * @param string|null $query подстрока поиска (пусто — все)
     * @param string $kind all|text|link
     * @param int $page страница 1-based
     * @param int $perPage размер страницы
     * @return LengthAwarePaginator пейджер пейлоадов toPayload()
     */
    public function list(User $user, ?string $query, string $kind, int $page, int $perPage): LengthAwarePaginator
    {
        $perPage = max(1, min(50, $perPage));
        $page = max(1, $page);

        $base = SavedNote::where('user_id', $user->id)
            ->when($kind === 'text' || $kind === 'link', fn ($q) => $q->where('kind', $kind))
            ->orderByDesc('updated_at')
            ->orderByDesc('id');

        $needle = mb_strtolower(trim((string) ($query ?? '')));

        if ($needle === '') {
            $paginator = $base->paginate($perPage, ['*'], 'page', $page);

            $paginator->setCollection(
                $paginator->getCollection()->map(fn (SavedNote $note) => $note->toPayload())
            );

            return $paginator;
        }

        $candidates = (clone $base)->limit(self::SEARCH_SCAN_LIMIT)->get();

        $matched = [];

        foreach ($candidates as $note) {
            $body = mb_strtolower($note->plainBody());

            if (str_contains($body, $needle)) {
                $matched[] = $note->toPayload();
            }
        }

        $total = count($matched);
        $slice = array_slice($matched, ($page - 1) * $perPage, $perPage);

        return new LengthAwarePaginator($slice, $total, $perPage, $page);
    }

    /**
     * Последние заметки для Telegram-бота (без поиска, свежие первые).
     *
     * @param User $user владелец
     * @param int $page страница 1-based
     * @param int $perPage размер страницы
     * @return array{notes:array<int, array<string, mixed>>, current_page:int, last_page:int, total:int}
     */
    public function latest(User $user, int $page, int $perPage): array
    {
        $paginator = $this->list($user, null, 'all', $page, $perPage);

        return [
            'notes' => $paginator->items(),
            'current_page' => $paginator->currentPage(),
            'last_page' => max(1, $paginator->lastPage()),
            'total' => $paginator->total(),
        ];
    }

    /**
     * Создать заметку владельцу.
     *
     * @param User $user владелец
     * @param string $body открытый текст (до 10000 символов)
     * @return SavedNote созданная заметка
     */
    public function create(User $user, string $body): SavedNote
    {
        $note = new SavedNote(['user_id' => $user->id]);
        $note->setPlainBody($body);
        $note->save();

        return $note;
    }

    /**
     * Режим хранения заметок пользователя.
     *
     * Лежит в users.settings JSON (ключ saved_notes_storage), дефолт server.
     * Режим local означает «только это устройство, без синхронизации».
     *
     * @param User $user владелец
     * @return string server|local
     */
    public function storageMode(User $user): string
    {
        $settings = $user->settings ?? [];
        $mode = (string) ($settings['saved_notes_storage'] ?? 'server');

        return in_array($mode, self::STORAGE_MODES, true) ? $mode : 'server';
    }

    /**
     * Сохранить режим хранения.
     *
     * @param User $user владелец
     * @param string $mode server|local
     * @return string сохранённый режим
     */
    public function setStorageMode(User $user, string $mode): string
    {
        $clean = in_array($mode, self::STORAGE_MODES, true) ? $mode : 'server';
        $settings = $user->settings ?? [];
        $settings['saved_notes_storage'] = $clean;
        $user->forceFill(['settings' => $settings])->save();

        return $clean;
    }
}
