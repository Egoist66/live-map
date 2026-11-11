<?php

namespace App\Services;

use App\Events\CommentThreadUpdated;
use App\Jobs\ModeratePublicContentJob;
use App\Models\PipeFollow;
use App\Models\PipeLike;
use App\Models\PipeReply;
use App\Models\PipeSave;
use App\Models\PipeThread;
use App\Models\PipeThreadMedia;
use App\Models\User;
use App\Models\UserBlock;
use App\Notifications\PipeMentionNotification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

/**
 * Сервис мини-приложения Pipe (pipe.ulove.by).
 *
 * Всё ядро ленты — фильтры, лайки, ответы, подписки — живёт тут,
 * контроллеры остаются тонкими. Модерация — трёхслойная, как на UFlow:
 * 1) ContentModeration::assertClean — синхронный фильтр запрещённых тем и мата на 422;
 * 2) FloodGuard — дубликаты, темп, КАПС, ссылки;
 * 3) ModeratePublicContentJob — второй проход очереди, злой текст
 *    уходит админам жалобой.
 * Счётчики лайков/ответов хранятся денормализованно и аккуратно двигаются.
 */
class PipeService
{
    /** Максимум картинок на тред Pipe. */
    private const MAX_THREAD_IMAGES = 3;

    /** Максимум закреплённых ответов в треде (как в Instagram). */
    private const MAX_PINNED_REPLIES = 3;
    /**
     * Проверка блокировок между смотрящим и автором (кроме самого себя и админа).
     *
     * @param User|null $viewer смотрящий
     * @param User $owner автор контента
     */
    public static function abortIfBlocked(?User $viewer, User $owner): void
    {
        if (! $viewer) {
            return;
        }

        $isSameUser = (int) $viewer->id === (int) $owner->id;
        $isAdmin = (bool) $viewer->isAdmin();
        $ownerIsAdmin = (bool) $owner->is_admin;

        if ($isSameUser || $isAdmin || $ownerIsAdmin) {
            return;
        }

        $blocked = UserBlock::where(function ($query) use ($viewer, $owner) {
            $query->where(function ($inner) use ($viewer, $owner) {
                $inner->where('blocker_id', $viewer->id)->where('blocked_id', $owner->id);
            })->orWhere(function ($inner) use ($viewer, $owner) {
                $inner->where('blocker_id', $owner->id)->where('blocked_id', $viewer->id);
            });
        })->exists();

        abort_if($blocked, 403, 'Недоступно');

        abort_unless($owner->isDiscoverableBy($viewer), 404);
    }

    /**
     * Лента тредов с фильтрами без перечисления в контроллере.
     *
     * @param User|null $viewer смотрящий (маскирует скрытых и заблокированных)
     * @param array{filter?:string, author_id?:int|null, thread_id?:int|null, search?:string|null} $filters
     * @return LengthAwarePaginator<PipeThread>
     */
    public static function feed(?User $viewer, array $filters): LengthAwarePaginator
    {
        $filter = $filters['filter'] ?? 'all';

        // Персональные выборки без смотрящего — пустая выдача, а не общая лента.
        if (! $viewer && in_array($filter, ['mine', 'following', 'saved'], true)) {
            return PipeThread::query()->whereRaw('0 = 1')->paginate(10);
        }

        $query = PipeThread::with(['user:id,name,profile_slug,avatar_path', 'media']);

        $hiddenIds = self::hiddenAuthorIds($viewer);

        if ($hiddenIds !== []) {
            $query->whereNotIn('user_id', $hiddenIds);
        }

        if (! empty($filters['thread_id'])) {
            $query->whereKey((int) $filters['thread_id']);
        }

        if (! empty($filters['author_id'])) {
            $query->where('user_id', (int) $filters['author_id']);
        } elseif (($filters['filter'] ?? 'all') === 'mine' && $viewer) {
            $query->where('user_id', $viewer->id);
        } elseif (($filters['filter'] ?? 'all') === 'following' && $viewer) {
            $followingIds = PipeFollow::where('follower_id', $viewer->id)
                ->pluck('following_id')
                ->map(fn ($id) => (int) $id)
                ->all();

            if ($followingIds === []) {
                return PipeThread::query()->whereRaw('0 = 1')->paginate(10);
            }

            $query->whereIn('user_id', $followingIds);
        } elseif (($filters['filter'] ?? 'all') === 'saved' && $viewer) {
            $savedIds = self::savedThreadIdsByUser((int) $viewer->id);

            if ($savedIds === []) {
                return PipeThread::query()->whereRaw('0 = 1')->paginate(10);
            }

            $query->whereKey($savedIds);
        }

        $searchTerm = trim((string) ($filters['search'] ?? ''));

        if ($searchTerm !== '') {
            $term = mb_substr($searchTerm, 0, 120);
            $query->where('body', 'like', '%'.$term.'%');
        }

        $query->latest('id');

        return $query->paginate(10);
    }

    /**
     * Авторы, скрытые из поиска для смотрящего (внешние видимости профилей).
     *
     * @param User|null $viewer смотрящий
     * @return list<int>
     */
    private static function hiddenAuthorIds(?User $viewer): array
    {
        try {
            $hiddenIds = User::hiddenFromSearchFor($viewer);
        } catch (\Throwable) {
            $hiddenIds = [];
        }

        if ($hiddenIds === []) {
            return [];
        }

        // Админов не прячем: их контент виден всем как в UFlow.
        $adminIds = User::whereIn('id', $hiddenIds)
            ->where('is_admin', true)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return array_values(array_diff($hiddenIds, $adminIds));
    }

    /**
     * Сериализовать тред для ленты/карточки/диплинка.
     *
     * @param PipeThread $thread тред
     * @param User|null $viewer смотрящий
     * @param array<int,bool> $likedMap карта лайков смотрящего: thread_id => bool
     * @param array<int,bool> $savedMap карта закладок смотрящего: thread_id => bool
     */
    public static function serializeThread(PipeThread $thread, ?User $viewer, array $likedMap = [], array $savedMap = []): array
    {
        $thread->loadMissing(['user:id,name,profile_slug,avatar_path', 'media']);

        $author = self::authorPayload($thread->user, (bool) $thread->is_anonymous, $viewer);

        $liked = $likedMap !== [] || $viewer ? ($likedMap[$thread->id] ?? self::likedByIds($thread, $viewer)) : false;

        $isOwn = $viewer && (int) $viewer->id === (int) $thread->user_id;

        $images = $thread->media
            ->map(fn (PipeThreadMedia $media) => [
                'id' => $media->id,
                'url' => $media->url,
                'thumb_url' => $media->thumb_url,
            ])
            ->values()
            ->all();

        return [
            'id' => $thread->id,
            'body' => $thread->body,
            'is_anonymous' => (bool) $thread->is_anonymous,
            'moderation' => ContentModeration::flagsFor($thread->body),
            'moderation_category' => $thread->moderation_category,
            'likes_count' => (int) $thread->likes_count,
            'replies_count' => (int) $thread->replies_count,
            'liked' => $liked,
            'saved' => $viewer ? (bool) ($savedMap[$thread->id] ?? PipeSave::existsBetween((int) $viewer->id, (int) $thread->id)) : false,
            'images' => $images,
            'can_edit' => $isOwn,
            'can_delete' => $isOwn || ($viewer && $viewer->isAdmin()),
            'created_at' => $thread->created_at?->toISOString(),
            'author' => $author,
        ];
    }

    /**
     * Сериализовать ответ.
     *
     * @param PipeReply $reply ответ
     * @param User|null $viewer смотрящий
     * @param array<int,bool> $likedMap карта лайков ответов смотрящего
     * @param bool $withChildren сериализовать ли один уровень вложенных ответов
     * @param PipeReply|null $knownParent уже загруженный родитель (дети ветки
     *                                     получают текущий ответ, чтобы не плодить запросов)
     */
    public static function serializeReply(PipeReply $reply, ?User $viewer, array $likedMap = [], bool $withChildren = false, ?PipeReply $knownParent = null): array
    {
        if ($withChildren) {
            $reply->loadMissing(['children.user:id,name,profile_slug,avatar_path']);
        }

        $reply->loadMissing('user:id,name,profile_slug,avatar_path');

        $author = self::authorPayload($reply->user, (bool) $reply->is_anonymous, $viewer);

        $isOwn = $viewer && (int) $viewer->id === (int) $reply->user_id;

        $parent = $knownParent ?? $reply->parent;

        if ($reply->parent_id && $parent && ! $parent->relationLoaded('user')) {
            $parent->loadMissing('user:id,name,profile_slug,avatar_path');
        }

        $parentPayload = null;

        if ($reply->parent_id && $parent) {
            $parentPayload = [
                'id' => $parent->id,
                'body' => $parent->body,
                'author' => self::authorPayload($parent->user, (bool) $parent->is_anonymous, $viewer),
            ];
        }

        $payload = [
            'id' => $reply->id,
            'thread_id' => $reply->thread_id,
            'parent_id' => $reply->parent_id,
            'body' => $reply->body,
            'is_anonymous' => (bool) $reply->is_anonymous,
            'is_pinned' => (bool) $reply->is_pinned,
            'pinned_at' => $reply->pinned_at?->toISOString(),
            'moderation' => ContentModeration::flagsFor($reply->body),
            'moderation_category' => $reply->moderation_category,
            'likes_count' => (int) $reply->likes_count,
            'liked' => (bool) ($likedMap[$reply->id] ?? false),
            'can_edit' => $isOwn,
            'can_delete' => $isOwn || ($viewer && $viewer->isAdmin()),
            'can_pin' => $reply->parent_id === null
                && $viewer !== null
                && ((int) $viewer->id === self::replyThreadAuthorId($reply) || $viewer->isAdmin()),
            'created_at' => $reply->created_at?->toISOString(),
            'updated_at' => $reply->updated_at?->toISOString(),
            'author' => $author,
            'parent' => $parentPayload,
            'replies_count' => 0,
            'replies' => [],
        ];

        if ($withChildren) {
            $children = $reply->children
                ->map(fn ($child) => self::serializeReply($child, $viewer, $likedMap, false, $reply))
                ->values()
                ->all();

            $payload['replies_count'] = count($children);
            $payload['replies'] = $children;
        }

        return $payload;
    }

    /**
     * Payload автора с учётом анонимности поста: аноним виден только
     * самому себе и staff — остальным достаётся «Аноним».
     *
     * @param User|null $author автор контента
     * @param bool $isAnonymous анонимное ли сообщение
     * @param User|null $viewer смотрящий
     */
    private static function authorPayload(?User $author, bool $isAnonymous, ?User $viewer): array
    {
        $isOwn = $viewer && $author && (int) $viewer->id === (int) $author->id;
        $isAdmin = $viewer && $viewer->isAdmin();

        if ($isAnonymous && ! ($isOwn || $isAdmin)) {
            return ['id' => null, 'name' => 'Аноним', 'profile_slug' => null, 'avatar_url' => null];
        }

        if (! $author) {
            return ['id' => null, 'name' => 'Пользователь', 'profile_slug' => null, 'avatar_url' => null];
        }

        return [
            'id' => $author->id,
            'name' => $author->name,
            'profile_slug' => $author->profile_slug,
            'avatar_url' => $author->avatar_url,
        ];
    }

    /**
     * Лайкнул ли смотрящий конкретный тред (для одиночной карточки).
     */
    private static function likedByIds(PipeThread $thread, ?User $viewer): bool
    {
        if (! $viewer) {
            return false;
        }

        return PipeLike::where('thread_id', $thread->id)->where('user_id', $viewer->id)->exists();
    }

    /**
     * Карта лайков смотрящего по странице ленты: thread_id => bool.
     * Один запрос вместо N+1 при сериализации.
     *
     * @param iterable<PipeThread> $threads треды страницы
     * @param User|null $viewer смотрящий
     * @return array<int,bool>
     */
    public static function likedThreadIds(iterable $threads, ?User $viewer): array
    {
        if (! $viewer) {
            return [];
        }

        $threadIds = [];
        foreach ($threads as $thread) {
            $threadIds[] = (int) $thread->id;
        }

        if ($threadIds === []) {
            return [];
        }

        $likedIds = PipeLike::where('user_id', $viewer->id)
            ->whereIn('thread_id', $threadIds)
            ->pluck('thread_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $map = [];

        foreach ($threadIds as $threadId) {
            $map[$threadId] = in_array($threadId, $likedIds, true);
        }

        return $map;
    }

    /**
     * Карта лайков смотрящего по списку ответов: reply_id => bool.
     *
     * @param iterable<PipeReply> $replies ответы
     * @param User|null $viewer смотрящий
     * @return array<int,bool>
     */
    public static function likedReplyIds(iterable $replies, ?User $viewer): array
    {        if (! $viewer) {
            return [];
        }

        $replyIds = [];
        foreach ($replies as $reply) {
            $replyIds[] = (int) $reply->id;
        }

        if ($replyIds === []) {
            return [];
        }

        $likedIds = PipeLike::where('user_id', $viewer->id)
            ->whereIn('reply_id', $replyIds)
            ->pluck('reply_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $map = [];

        foreach ($replyIds as $replyId) {
            $map[$replyId] = in_array($replyId, $likedIds, true);
        }

        return $map;
    }

    /**
     * Идентификаторы тредов, сохранённых пользователем (свежие сверху).
     *
     * @param int $userId владелец закладок
     * @return list<int>
     */
    public static function savedThreadIdsByUser(int $userId): array
    {
        return PipeSave::where('user_id', $userId)
            ->orderByDesc('id')
            ->pluck('thread_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Карта закладок смотрящего по странице ленты: thread_id => bool.
     * Один запрос вместо N+1 при сериализации.
     *
     * @param iterable<PipeThread> $threads треды страницы
     * @param User|null $viewer смотрящий
     * @return array<int,bool>
     */
    public static function savedThreadIds(iterable $threads, ?User $viewer): array
    {
        if (! $viewer) {
            return [];
        }

        $threadIds = [];
        foreach ($threads as $thread) {
            $threadIds[] = (int) $thread->id;
        }

        if ($threadIds === []) {
            return [];
        }

        $savedIds = PipeSave::where('user_id', $viewer->id)
            ->whereIn('thread_id', $threadIds)
            ->pluck('thread_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $map = [];

        foreach ($threadIds as $threadId) {
            $map[$threadId] = in_array($threadId, $savedIds, true);
        }

        return $map;
    }

    /**
     * Создать тред: модерация → FloodGuard → запись → картинки → realtime.
     *
     * Картинки проверяются модерацией ДО создания треда: запрещённое
     * фото отклоняет весь запрос на 422, а не создаёт тред с молча
     * пропущенной картинкой.
     *
     * @param User $user автор
     * @param array{body:string, is_anonymous:bool} $data провалидированный payload
     * @param array<int, UploadedFile> $images картинки (максимум 3, остальное срезается)
     * @return PipeThread созданный тред
     *
     * @throws \Illuminate\Validation\ValidationException при запрещённом тексте или фото
     */
    public static function createThread(User $user, array $data, array $images = []): PipeThread
    {
        $body = trim((string) $data['body']);

        ContentModeration::assertClean($body);
        TextModerationService::assertClean($body);

        self::assertThreadImagesAllowed($images);

        $guard = new FloodGuard();
        $guard->assertNotFlooding($user, $body, 'pipe_thread');

        $thread = PipeThread::create([
            'user_id' => $user->id,
            'body' => $body,
            'is_anonymous' => (bool) ($data['is_anonymous'] ?? false),
        ]);

        self::storeThreadMedia($thread, $images);

        $guard->remember($user, $body, 'pipe_thread');
        self::dispatchModerationReview('pipe_thread', (int) $thread->id, (int) $user->id, $body);
        self::notifyThreadMentions($thread, $user);

        return $thread;
    }

    /**
     * Проверить картинки треда модерацией (до создания треда).
     *
     * Первое запрещённое фото отклоняет весь запрос на 422 — как и
     * загрузку аватара/фото профиля.
     *
     * @param array<int, UploadedFile> $images загруженные файлы
     *
     * @throws \Illuminate\Validation\ValidationException при запрещённом фото
     */
    private static function assertThreadImagesAllowed(array $images): void
    {
        foreach ($images as $image) {
            if ($image instanceof UploadedFile) {
                PhotoModerationService::assertAllowed($image);
            }
        }
    }

    /**
     * Сохранить картинки треда (до 3): оптимизация + thumb + строки медиа.
     *
     * Модерация уже пройдена в createThread (assertThreadImagesAllowed);
     * здесь ошибки одного файла не роняют тред: неудачные просто пропускаются.
     *
     * @param PipeThread $thread тред
     * @param array<int, UploadedFile> $images загруженные файлы
     */
    public static function storeThreadMedia(PipeThread $thread, array $images): void
    {
        $accepted = array_slice(array_values(array_filter($images)), 0, self::MAX_THREAD_IMAGES);

        if ($accepted === []) {
            return;
        }

        $disk = MediaDisk::disk();
        $sort = (int) $thread->media()->max('sort_order');

        foreach ($accepted as $image) {
            $sort += 1;

            try {
                $path = ImageOptimizer::storeOptimized($image, 'pipe-threads', $disk, [
                    'maxSide' => ImageOptimizer::GALLERY_MAX_SIDE,
                ]);
            } catch (\Throwable $error) {
                Log::warning('pipe thread media upload failed', ['error' => $error->getMessage()]);
                $sort -= 1;
                continue;
            }

            $thumbPath = ImageOptimizer::storeThumbnail($path, $disk);

            PipeThreadMedia::create([
                'thread_id' => $thread->id,
                'path' => $path,
                'thumb_path' => $thumbPath,
                'sort_order' => $sort,
            ]);
        }
    }

    /**
     * Редактировать свой тред: та же модерация и защита от флуда.
     * Второй проход модерации диспатчится заново — текст мог стать злым.
     *
     * @param PipeThread $thread тред-оригинал
     * @param User $user редактор (владелец или админ)
     * @param array{body:string} $data провалидированный payload
     * @return PipeThread обновлённый тред
     *
     * @throws \Illuminate\Validation\ValidationException при запрещённом тексте
     */
    public static function updateThread(PipeThread $thread, User $user, array $data): PipeThread
    {
        $body = trim((string) $data['body']);

        ContentModeration::assertClean($body);
        TextModerationService::assertClean($body);

        $guard = new FloodGuard();
        $guard->assertNotFlooding($user, $body, 'pipe_thread');

        $thread->update(['body' => $body]);

        $guard->remember($user, $body, 'pipe_thread');
        self::dispatchModerationReview('pipe_thread', (int) $thread->id, (int) $thread->user_id, $body);

        return $thread;
    }

    /**
     * Создать ответ: модерация + FloodGuard + счётчики + realtime.
     *
     * @param User $user автор
     * @param PipeThread $thread тред-родитель
     * @param array{body:string, is_anonymous:bool, parent_id?:int|null} $data провалидированный payload
     * @param PipeReply|null $parent родительский ответ (или null)
     * @return PipeReply созданный ответ
     *
     * @throws \Illuminate\Validation\ValidationException при запрещённом тексте
     */
    public static function createReply(User $user, PipeThread $thread, array $data, ?PipeReply $parent = null): PipeReply
    {
        $body = trim((string) $data['body']);

        ContentModeration::assertClean($body);
        TextModerationService::assertClean($body);

        $guard = new FloodGuard();
        $guard->assertNotFlooding($user, $body, 'pipe_reply');

        $reply = PipeReply::create([
            'thread_id' => $thread->id,
            'parent_id' => $parent?->id,
            'user_id' => $user->id,
            'body' => $body,
            'is_anonymous' => (bool) ($data['is_anonymous'] ?? false),
        ]);

        $thread->increment('replies_count');

        $guard->remember($user, $body, 'pipe_reply');
        self::dispatchModerationReview('pipe_reply', (int) $reply->id, (int) $user->id, $body);

        CommentThreadUpdated::touch('pipe', (int) $thread->id);

        $kind = $parent ? 'pipe_reply_reply' : 'pipe_reply';
        self::notifyTargets($kind, $thread, $reply, $parent, $user);
        self::notifyMentions($thread, $reply, $user, $parent);

        return $reply;
    }

    /**
     * Обновить свой ответ: только владелец (чужой нельзя даже админу,
     * как у комментов UFlow), с теми же фильтрами модерации, что и
     * при создании. После правки тред тянется realtime-событием.
     *
     * @param User $user автор ответа
     * @param PipeReply $reply ответ
     * @param string $body новый текст
     * @return PipeReply обновлённый ответ
     *
     * @throws \Illuminate\Auth\Access\AuthorizationException чужой ответ
     * @throws \Illuminate\Validation\ValidationException запрещённый текст
     */
    public static function updateReply(User $user, PipeReply $reply, string $body): PipeReply
    {
        abort_unless((int) $user->id === (int) $reply->user_id, 403, 'Редактировать можно только свой ответ');

        $text = trim($body);

        ContentModeration::assertClean($text);
        TextModerationService::assertClean($text);

        $reply->update(['body' => $text]);

        CommentThreadUpdated::touch('pipe', (int) $reply->thread_id);

        return $reply;
    }

    /**
     * Закрепить / открепить ответ треда (как в Instagram).
     *
     * Закреплять может только автор треда (или админ), только ответы
     * верхнего уровня, максимум MAX_PINNED_REPLIES на тред. После
     * смены флага тред тянется realtime-событием thread:updated.
     *
     * @param User $user кто закрепляет
     * @param PipeReply $reply ответ
     * @return array{id:int,pinned:bool}
     *
     * @throws \Symfony\Component\HttpKernel\Exception\HttpException не автор, вложенный ответ или лимит
     */
    public static function toggleReplyPin(User $user, PipeReply $reply): array
    {
        abort_unless($reply->parent_id === null, 422, 'Закреплять можно только ответы верхнего уровня');

        $thread = $reply->thread()->firstOrFail();
        $isThreadAuthor = (int) $user->id === (int) $thread->user_id;

        abort_unless($isThreadAuthor || $user->isAdmin(), 403, 'Закреплять может только автор треда');

        $reply->refresh();

        if ($reply->is_pinned) {
            $reply->update(['is_pinned' => false, 'pinned_at' => null]);
            $isPinned = false;
        } else {
            $pinnedCount = PipeReply::where('thread_id', $thread->id)
                ->where('is_pinned', true)
                ->count();

            abort_if($pinnedCount >= self::MAX_PINNED_REPLIES, 422, 'Можно закрепить не больше '.self::MAX_PINNED_REPLIES.' ответов');

            $reply->update(['is_pinned' => true, 'pinned_at' => now()]);
            $isPinned = true;
        }

        CommentThreadUpdated::touch('pipe', (int) $thread->id);

        return ['id' => (int) $reply->id, 'pinned' => $isPinned];
    }

    /**
     * id автора треда ответа (для can_pin): берём из eager-loaded связи,
     * иначе — один лёгкий запрос.
     *
     * @param PipeReply $reply ответ
     * @return int id автора треда
     */
    private static function replyThreadAuthorId(PipeReply $reply): int
    {
        if ($reply->relationLoaded('thread')) {
            return (int) $reply->thread->user_id;
        }

        $thread = $reply->thread()->first(['user_id']);

        return (int) ($thread->user_id ?? 0);
    }

    /**
     * Упоминания @ник в ответе: уведомить упомянутых, кроме уже
     * уведомленных (автор треда, автор родительского ответа),
     * самого актора и людей в блокировках.
     * @param PipeThread $thread тред
     * @param PipeReply $reply свежий ответ
     * @param User $actor автор ответа
     * @param PipeReply|null $parent родительский ответ (его автор уже уведомлен)
     */
    private static function notifyMentions(PipeThread $thread, PipeReply $reply, User $actor, ?PipeReply $parent): void
    {
        try {
            $mentionedIds = Mentions::extractIds($reply->body, (int) $actor->id);
            $notifyableIds = Mentions::notifyableIds($mentionedIds, (int) $actor->id);

            $skipIds = [(int) $thread->user_id, (int) $actor->id];

            if ($parent) {
                $skipIds[] = (int) $parent->user_id;
            }

            foreach ($notifyableIds as $userId) {
                if (in_array($userId, $skipIds, true)) {
                    continue;
                }

                $mentioned = User::find($userId);

                if ($mentioned) {
                    UserNotifier::send($mentioned, new PipeMentionNotification($thread, $reply, self::excerpt($reply->body), $actor, $userId));
                }
            }
        } catch (\Throwable $error) {
            Log::warning('pipe mention notify failed', ['error' => $error->getMessage()]);
        }
    }

    /**
     * Упоминания @ник в теле нового треда: уведомить упомянутых,
     * кроме автора треда и людей в блокировках.
     *
     * @param PipeThread $thread свежий тред
     * @param User $actor автор треда
     */
    private static function notifyThreadMentions(PipeThread $thread, User $actor): void
    {
        try {
            $mentionedIds = Mentions::extractIds($thread->body, (int) $actor->id);
            $notifyableIds = Mentions::notifyableIds($mentionedIds, (int) $actor->id);

            $skipIds = [(int) $thread->user_id, (int) $actor->id];

            foreach ($notifyableIds as $userId) {
                if (in_array($userId, $skipIds, true)) {
                    continue;
                }

                $mentioned = User::find($userId);

                if ($mentioned) {
                    UserNotifier::send($mentioned, new PipeMentionNotification($thread, null, self::excerpt($thread->body), $actor, $userId));
                }
            }
        } catch (\Throwable $error) {
            Log::warning('pipe thread mention notify failed', ['error' => $error->getMessage()]);
        }
    }

    /**
     * Короткий анонс текста (обёртка над UserNotification::excerpt).
     *
     * @param string|null $text исходный текст
     * @return string|null анонс до ~90 символов
     */
    private static function excerpt(?string $text): ?string
    {
        return UserNotification::excerpt($text);
    }

    /**
     * Переключить лайк треда или ответа: атомарно, у одного юзера по лайку.
     *
     * @param User $user кто лайкает
     * @param PipeThread|PipeReply $target лайкнутая сущность
     * @return array{liked:bool, likes_count:int}
     */
    public static function toggleLike(User $user, PipeThread|PipeReply $target): array
    {
        $isThread = $target instanceof PipeThread;

        $existing = PipeLike::when($isThread, fn ($query) => $query->where('thread_id', $target->id))
            ->when(! $isThread, fn ($query) => $query->where('reply_id', $target->id))
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            $existing->delete();
            $target->decrement('likes_count');

            try {
                PipeNotifier::unliked($target, $user);
            } catch (\Throwable $error) {
                Log::warning('pipe unlike notify failed', ['error' => $error->getMessage()]);
            }

            return ['liked' => false, 'likes_count' => (int) $target->refresh()->likes_count];
        }

        PipeLike::create([
            'user_id' => $user->id,
            'thread_id' => $isThread ? $target->id : null,
            'reply_id' => $isThread ? null : $target->id,
        ]);

        $target->increment('likes_count');

        $author = $target->user;
        $isSelfLike = $author && (int) $author->id === (int) $user->id;

        if (! $isSelfLike) {
            try {
                PipeNotifier::liked($target, $user);
            } catch (\Throwable $error) {
                Log::warning('pipe like notify failed', ['error' => $error->getMessage()]);
            }
        }

        return ['liked' => true, 'likes_count' => (int) $target->refresh()->likes_count];
    }

    /**
     * Подписаться/отписаться на треды автора.
     *
     * @param User $user читающий
     * @param User $target автор тредов
     * @return array{following:bool}
     */
    public static function toggleFollow(User $user, User $target): array
    {
        if ((int) $target->id === (int) $user->id) {
            abort(422, 'Нельзя подписаться на себя');
        }

        $isFollowing = PipeFollow::existsBetween($user->id, (int) $target->id);

        if ($isFollowing) {
            PipeFollow::where('follower_id', $user->id)
                ->where('following_id', $target->id)
                ->delete();

            return ['following' => false];
        }

        PipeFollow::create(['follower_id' => $user->id, 'following_id' => $target->id]);

        try {
            PipeNotifier::followed($target, $user);
        } catch (\Throwable $error) {
            Log::warning('pipe follow notify failed', ['error' => $error->getMessage()]);
        }

        return ['following' => true];
    }

    /**
     * Сохранить тред в избранное / убрать закладку.
     *
     * Закладка приватная: автору ничего не уходит, видимость треда для
     * смотрящего уже проверена контроллером (тред из его ленты).
     *
     * @param User $user владелец закладки
     * @param PipeThread $thread тред
     * @return array{saved:bool}
     */
    public static function toggleSave(User $user, PipeThread $thread): array
    {
        $existing = PipeSave::where('user_id', $user->id)
            ->where('thread_id', $thread->id)
            ->first();

        if ($existing) {
            $existing->delete();

            return ['saved' => false];
        }

        PipeSave::create(['user_id' => $user->id, 'thread_id' => $thread->id]);

        return ['saved' => true];
    }

    /**
     * Уведомить автора треда и автора родительского ответа.
     *
     * @param string $kind pipe_reply|pipe_reply_reply
     * @param PipeThread $thread тред
     * @param PipeReply $reply свежий ответ
     * @param PipeReply|null $parent родительский ответ
     * @param User $actor автор ответа
     */
    private static function notifyTargets(string $kind, PipeThread $thread, PipeReply $reply, ?PipeReply $parent, User $actor): void
    {
        try {
            PipeNotifier::replied($thread, $reply, $parent, $actor);
        } catch (\Throwable $error) {
            Log::warning("pipe {$kind} notify failed", ['error' => $error->getMessage()]);
        }
    }

    /**
     * Второй проход модерации в очереди (ошибки не должны ронять запись).
     *
     * @param string $kind pipe_thread|pipe_reply
     * @param int $entityId id сущности
     * @param int $authorId id автора
     * @param string $text текст
     */
    private static function dispatchModerationReview(string $kind, int $entityId, int $authorId, string $text): void
    {
        try {
            ModeratePublicContentJob::dispatch($kind, $entityId, $authorId, $text);
        } catch (\Throwable $error) {
            Log::warning('pipe moderation review dispatch failed', ['error' => $error->getMessage()]);
        }
    }
}
