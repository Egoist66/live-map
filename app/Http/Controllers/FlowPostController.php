<?php

namespace App\Http\Controllers;

use App\Models\FlowPoll;
use App\Models\FlowPollOption;
use App\Models\FlowPollVote;
use App\Models\FlowPost;
use App\Models\FlowPostLike;
use App\Models\FlowPostMedia;
use App\Models\UserBlock;
use App\Services\ActivityRewards;
use App\Services\ContentModeration;
use App\Services\FlowHashtags;
use App\Services\FlowPollService;
use App\Services\FlowPostNotifier;
use App\Services\ImageOptimizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Лента UFlow: посты пользователей, видимые всем.
 *
 * Пост создаётся в своём профиле или в общей ленте,
 * читают все, комментируют все, подписчики получают уведомление.
 */
class FlowPostController extends Controller
{
    /**
     * Диск для картинок: S3 когда настроен, иначе public.
     */
    private function disk(): string
    {
        $isS3 = config('filesystems.default') === 's3'
            && config('filesystems.disks.s3.bucket');

        return $isS3 ? 's3' : 'public';
    }

    /**
     * Проверить, что просмотр не заблокирован.
     *
     * @param \App\Models\User $viewer смотрящий
     * @param \App\Models\User $owner автор
     */
    private function abortIfBlocked($viewer, $owner): void
    {
        if ((int) $viewer->id === (int) $owner->id || $viewer->isAdmin()) {
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

        if ($owner->is_admin) {
            return;
        }

        abort_unless($owner->isDiscoverableBy($viewer), 404);
    }

    /**
     * Сериализация поста для ленты.
     *
     * @param FlowPost $post пост
     * @param \App\Models\User|null $viewer смотрящий
     * @param array<int,int> $pollVotes карта голосов (батч для ленты)
     * @param array<int,int> $myReposts карта репостов (батч для ленты)
     */
    private function serialize(FlowPost $post, $viewer, array $pollVotes = [], array $myReposts = []): array
    {
        $post->loadMissing(['user:id,name,avatar_path,flow_comments_privacy', 'media', 'poll.options', 'tags:id,name', 'business.user:id,profile_slug']);

        $author = $post->user;
        $isOwn = $viewer && (int) $viewer->id === (int) $post->user_id;
        $canSeeAuthor = ! $post->is_anonymous || $isOwn || ($viewer && $viewer->isAdmin());
        $canComment = $viewer && $author ? $viewer->canCommentFlowPost($author) : false;

        $liked = false;
        if ($viewer) {
            $liked = FlowPostLike::where('post_id', $post->id)
                ->where('user_id', $viewer->id)
                ->exists();
        }

        $media = $post->media
            ->map(fn ($item) => [
                'id' => (int) $item->id,
                'kind' => $item->kind,
                'url' => $item->url,
                'duration_sec' => $item->duration_sec ? (int) $item->duration_sec : null,
            ])
            ->values()
            ->all();

        $firstPhotoUrl = null;
        foreach ($media as $item) {
            if ($item['kind'] === 'photo' && $item['url']) {
                $firstPhotoUrl = $item['url'];
                break;
            }
        }

        $rootId = (int) ($post->repost_of_id ?: $post->id);

        $company = null;
        $business = $post->business;

        if ($business) {
            $company = [
                'id' => (int) $business->id,
                'name' => (string) ($business->name ?? ''),
                'brand' => $business->brand ?? null,
                'logo_url' => $business->logo_url,
                'is_verified' => $business->isVerified(),
                'owner_profile' => $business->user?->profileIdentifier(),
            ];
        }

        return [
            'id' => $post->id,
            'title' => $post->title,
            'body' => $post->body,
            'moderation' => ContentModeration::flagsFor($post->title, $post->body, $post->repost_comment),
            'company' => $company,
            'image_url' => $firstPhotoUrl ?? $post->image_url,
            'media' => $media,
            'poll' => $post->poll ? FlowPollService::serialize($post->poll, $viewer, $pollVotes) : null,
            'tags' => $post->tags->pluck('name')->values()->all(),
            'is_anonymous' => (bool) $post->is_anonymous,
            'likes_count' => (int) $post->likes_count,
            'comments_count' => (int) $post->comments_count,
            'repost_of_id' => $post->repost_of_id ? (int) $post->repost_of_id : null,
            'repost_comment' => $post->repost_comment,
            'reposts_count' => (int) ($post->reposts_count ?? 0),
            'my_repost_id' => $myReposts[$rootId] ?? null,
            'repost' => $this->serializeOriginal($post, $viewer),
            'liked' => $liked,
            'can_edit' => $isOwn,
            'can_delete' => $isOwn || ($viewer && $viewer->isAdmin()),
            'can_comment' => (bool) $canComment,
            'created_at' => $post->created_at?->toISOString(),
            'updated_at' => $post->updated_at?->toISOString(),
            'author' => $canSeeAuthor && $author ? [
                'id' => $author->id,
                'name' => $author->name,
                'profile_slug' => $author->profile_slug,
                'avatar_url' => $author->avatar_url,
            ] : [
                'id' => null,
                'name' => 'Аноним',
                'avatar_url' => null,
            ],
        ];
    }

    /**
     * Встроенный оригинал репоста с учётом анонимности.
     *
     * @param FlowPost $post репост
     * @param \App\Models\User|null $viewer смотрящий
     */
    private function serializeOriginal(FlowPost $post, $viewer): ?array
    {
        if (! $post->repost_of_id) {
            return null;
        }

        $post->loadMissing(['original.user:id,name,profile_slug,avatar_path', 'original.media', 'original.business.user:id,profile_slug']);

        $original = $post->original;

        if (! $original) {
            return null;
        }

        $originalCompany = null;
        $originalBusiness = $original->business;

        if ($originalBusiness) {
            $originalCompany = [
                'id' => (int) $originalBusiness->id,
                'name' => (string) ($originalBusiness->name ?? ''),
                'brand' => $originalBusiness->brand ?? null,
                'logo_url' => $originalBusiness->logo_url,
                'is_verified' => $originalBusiness->isVerified(),
                'owner_profile' => $originalBusiness->user?->profileIdentifier(),
            ];
        }

        $originalPhoto = $original->media
            ->first(fn ($item) => $item->kind === 'photo' && $item->url);

        $isOwnOriginal = $viewer && (int) $viewer->id === (int) $original->user_id;

        $canSeeAuthor = ! $original->is_anonymous || $isOwnOriginal || ($viewer && $viewer->isAdmin());

        $author = $original->user;

        if ($canSeeAuthor && $author) {
            $authorPayload = [
                'id' => $author->id,
                'name' => $author->name,
                'profile_slug' => $author->profile_slug,
                'avatar_url' => $author->avatar_url,
            ];
        } else {
            $authorPayload = [
                'id' => null,
                'name' => 'Аноним',
                'avatar_url' => null,
            ];
        }

        return [
            'id' => $original->id,
            'title' => $original->title,
            'body' => $original->body,
            'moderation' => ContentModeration::flagsFor($original->title, $original->body),
            'image_url' => $originalPhoto?->url ?? $original->image_url,
            'author' => $authorPayload,
            'company' => $originalCompany,
        ];
    }

    /**
     * Лента постов: все / подписки / мои / автора.
     *
     * Авторы, скрытые из поиска для смотрящего, из ленты исключаются:
     * иначе пост виден, а лайки/комменты отдают 404 из abortIfBlocked.
     * Посты админов видны всем всегда (комменты к ним режет уже
     * flow_comments_privacy + блокировки). Свои посты и просмотр
     * админа не фильтруются.
     *
     * @param Request $request запрос с фильтрами
     */
    public function index(Request $request)
    {
        $viewer = $request->user();

        $data = $request->validate([
            'filter' => 'sometimes|in:all,subscriptions,mine',
            'author_id' => 'sometimes|integer|exists:users,id',
            'search' => 'sometimes|string|max:120',
            'post_id' => 'sometimes|integer|exists:flow_posts,id',
            'tag' => 'sometimes|string|max:52',
        ]);

        $filter = $data['filter'] ?? 'all';
        $query = FlowPost::with(['user:id,name,profile_slug,avatar_path', 'media', 'poll.options', 'tags:id,name', 'business.user:id,profile_slug']);

        $hiddenIds = \App\Models\User::hiddenFromSearchFor($viewer);

        if (! empty($hiddenIds)) {
            $adminIds = \App\Models\User::whereIn('id', $hiddenIds)
                ->where('is_admin', true)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            $hiddenIds = array_values(array_diff($hiddenIds, $adminIds));
        }

        if (! empty($hiddenIds)) {
            $query->whereNotIn('user_id', $hiddenIds);
        }

        if (! empty($data['post_id'])) {
            $query->whereKey($data['post_id']);
        }

        if (! empty($data['author_id'])) {
            $query->where('user_id', (int) $data['author_id']);
        } elseif ($filter === 'mine') {
            $query->where('user_id', $viewer->id);
        } elseif ($filter === 'subscriptions') {
            $targetIds = \App\Models\UserSubscription::where('subscriber_id', $viewer->id)
                ->pluck('target_id')
                ->map(fn ($value) => (int) $value)
                ->all();

            if (empty($targetIds)) {
                return response()->json(['data' => [], 'meta' => ['empty' => true]]);
            }

            $query->whereIn('user_id', $targetIds);
        }

        if (! empty($data['search'])) {
            $term = mb_substr(trim($data['search']), 0, 120);
            $query->where(function ($inner) use ($term) {
                $inner->where('body', 'like', '%'.$term.'%');
                $inner->orWhere('title', 'like', '%'.$term.'%');
            });
        }

        if (! empty($data['tag'])) {
            $tagName = mb_strtolower(ltrim(trim((string) $data['tag']), '#'));

            if ($tagName !== '') {
                $query->whereHas('tags', fn ($tagQuery) => $tagQuery->where('name', $tagName));
            }
        }

        $query
            ->orderByRaw('(flow_posts.business_id IS NOT NULL) DESC')
            ->latest();

        $posts = $query->paginate(10);

        $collection = $posts->getCollection();

        $pollVotes = $this->pollVotesMap($collection, $viewer);
        $myReposts = $this->myRepostsMap($collection, $viewer);

        $collection->transform(fn ($post) => $this->serialize($post, $viewer, $pollVotes, $myReposts));

        return $posts;
    }

    /**
     * Карта голосов смотрящего для опросов страницы: poll_id => option_id.
     *
     * Один запрос вместо N+1 при сериализации ленты.
     *
     * @param \Illuminate\Support\Collection $posts посты страницы
     * @param \App\Models\User|null $viewer смотрящий
     * @return array<int,int>
     */
    private function pollVotesMap($posts, $viewer): array
    {
        if (! $viewer) {
            return [];
        }

        $pollIds = $posts
            ->filter(fn ($post) => $post->poll)
            ->map(fn ($post) => (int) $post->poll->id)
            ->values()
            ->all();

        if (empty($pollIds)) {
            return [];
        }

        return FlowPollVote::where('user_id', $viewer->id)
            ->whereIn('poll_id', $pollIds)
            ->pluck('option_id', 'poll_id')
            ->map(fn ($optionId) => (int) $optionId)
            ->all();
    }

    /**
     * Карта репостов смотрящего для постов страницы: root_id => repost_id.
     *
     * Один запрос вместо N+1, кнопка репоста сразу знает состояние.
     *
     * @param \Illuminate\Support\Collection $posts посты страницы
     * @param \App\Models\User|null $viewer смотрящий
     * @return array<int,int>
     */
    private function myRepostsMap($posts, $viewer): array
    {
        if (! $viewer) {
            return [];
        }

        $rootIds = $posts
            ->map(fn ($post) => (int) ($post->repost_of_id ?: $post->id))
            ->unique()
            ->values()
            ->all();

        if (empty($rootIds)) {
            return [];
        }

        return FlowPost::where('user_id', $viewer->id)
            ->whereIn('repost_of_id', $rootIds)
            ->pluck('id', 'repost_of_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Один пост.
     *
     * @param FlowPost $post пост
     */
    public function show(Request $request, FlowPost $post)
    {
        return response()->json($this->serialize($post, $request->user()));
    }

    /**
     * Создать пост. Анонимный разовый доступен всем,
     * режим «всегда анонимно» — PRO (настраивается в профиле).
     *
     * @param Request $request запрос
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'title' => 'nullable|string|max:150',
            'body' => 'required|string|max:2000',
            'image' => 'nullable|image|max:10240',
            'images' => 'nullable|array|max:4',
            'images.*' => 'nullable|image|max:10240',
            'video' => 'nullable|file|mimetypes:video/mp4,video/webm,video/quicktime,video/3gpp,video/3gpp2,video/x-m4v|max:51200',
            'is_anonymous' => 'sometimes|boolean',
            'poll.options' => 'nullable|array|min:2|max:4',
            'poll.options.*' => 'nullable|string|max:120',
            'poll.closes_in_hours' => 'nullable|integer|min:1|max:168',
        ]);

        ContentModeration::assertClean($data['title'] ?? null, $data['body']);

        $images = $this->uploadedImages($request);
        $hasVideo = $request->hasFile('video');

        abort_if($hasVideo && ! empty($images), 422, 'Видео или фото — выберите что-то одно');

        $pollOptions = $this->cleanPollOptions($data['poll']['options'] ?? null);

        $isAnonymous = (bool) ($data['is_anonymous'] ?? $user->is_anonymous_default ?? false);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = ImageOptimizer::storeOptimized($request->file('image'), 'flow-posts', $this->disk());
        }

        $post = FlowPost::create([
            'user_id' => $user->id,
            'title' => isset($data['title']) && trim((string) $data['title']) !== '' ? trim((string) $data['title']) : null,
            'body' => trim($data['body']),
            'image_path' => $imagePath,
            'is_anonymous' => $isAnonymous,
        ]);

        $this->storeMedia($post, $images, $hasVideo ? $request->file('video') : null);
        $this->storePoll($post, $pollOptions, isset($data['poll']['closes_in_hours']) ? (int) $data['poll']['closes_in_hours'] : null);
        FlowHashtags::sync($post);

        try {
            \App\Jobs\ModeratePublicContentJob::dispatch('flow_post', (int) $post->id, (int) $user->id, trim((string) ($data['title'] ?? '').' '.(string) $data['body']));
        } catch (\Throwable) {
        }

        try {
            FlowPostNotifier::postCreated($post->refresh());
        } catch (\Throwable) {
        }

        $payload = $this->serialize($post->refresh(), $user);
        $reward = ActivityRewards::award($user, 'flow_post', 'flow_post', $post->id);

        if ($reward !== null) {
            $payload['reward'] = $reward;
        }

        return response()->json($payload, 201);
    }

    /**
     * Файлы картинок из запроса: новое поле images[] плюс легаси image.
     *
     * @param Request $request запрос
     * @return array<\Illuminate\Http\UploadedFile>
     */
    private function uploadedImages(Request $request): array
    {
        $images = [];

        foreach ((array) $request->file('images', []) as $file) {
            if ($file) {
                $images[] = $file;
            }
        }

        if ($request->hasFile('image')) {
            $images[] = $request->file('image');
        }

        return array_slice($images, 0, 4);
    }

    /**
     * Почистить варианты опроса: непустые уникальные строки.
     *
     * @param mixed $raw варианты из запроса
     * @return array<string>
     */
    private function cleanPollOptions($raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $options = [];

        foreach ($raw as $text) {
            $clean = trim((string) $text);

            if ($clean !== '' && ! in_array($clean, $options, true)) {
                $options[] = mb_substr($clean, 0, 120);
            }
        }

        return $options;
    }

    /**
     * Сохранить медиа поста: фото (до 4) или одно видео.
     *
     * @param FlowPost $post пост
     * @param array<\Illuminate\Http\UploadedFile> $images картинки
     * @param \Illuminate\Http\UploadedFile|null $video видео
     */
    private function storeMedia(FlowPost $post, array $images, $video): void
    {
        $sort = 0;

        foreach ($images as $file) {
            $path = ImageOptimizer::storeOptimized($file, 'flow-posts', $this->disk());

            FlowPostMedia::create([
                'post_id' => $post->id,
                'kind' => 'photo',
                'path' => $path,
                'sort_order' => $sort++,
            ]);
        }

        if ($video) {
            $path = $video->store('flow-posts', $this->disk());

            FlowPostMedia::create([
                'post_id' => $post->id,
                'kind' => 'video',
                'path' => $path,
                'sort_order' => $sort,
            ]);
        }
    }

    /**
     * Создать опрос поста (вариантов уже проверено 2–4).
     *
     * @param FlowPost $post пост
     * @param array<string> $options варианты
     * @param int|null $closesInHours дедлайн в часах
     */
    private function storePoll(FlowPost $post, array $options, ?int $closesInHours): void
    {
        if (count($options) < 2) {
            return;
        }

        $poll = FlowPoll::create([
            'post_id' => $post->id,
            'closes_at' => $closesInHours ? now()->addHours($closesInHours) : null,
        ]);

        $sort = 0;

        foreach (array_slice($options, 0, 4) as $text) {
            ContentModeration::assertClean($text);

            FlowPollOption::create([
                'poll_id' => $poll->id,
                'text' => $text,
                'sort_order' => $sort++,
            ]);
        }
    }

    /**
     * Удалить всё медиа поста вместе с файлами.
     *
     * @param FlowPost $post пост
     */
    private function deleteMedia(FlowPost $post): void
    {
        $paths = FlowPostMedia::where('post_id', $post->id)->pluck('path')->all();

        foreach ($paths as $path) {
            Storage::disk($this->disk())->delete($path);
        }

        FlowPostMedia::where('post_id', $post->id)->delete();
    }

    /**
     * Обновить свой пост. Редактировать чужой запрещено даже админу:
     * максимум админа — удалить пост при нарушении правил.
     *
     * @param Request $request запрос
     * @param FlowPost $post пост
     */
    public function update(Request $request, FlowPost $post)
    {
        $user = $request->user();
        abort_unless((int) $user->id === (int) $post->user_id, 403);

        $data = $request->validate([
            'title' => 'sometimes|nullable|string|max:150',
            'body' => 'sometimes|string|max:2000',
            'image' => 'nullable|image|max:10240',
            'images' => 'nullable|array|max:4',
            'images.*' => 'nullable|image|max:10240',
            'video' => 'nullable|file|mimetypes:video/mp4,video/webm,video/quicktime,video/3gpp,video/3gpp2,video/x-m4v|max:51200',
            'remove_image' => 'sometimes|boolean',
            'remove_media' => 'sometimes|boolean',
            'is_anonymous' => 'sometimes|boolean',
        ]);

        if (array_key_exists('title', $data)) {
            ContentModeration::assertClean($data['title']);

            $title = trim((string) ($data['title'] ?? ''));
            $post->title = $title !== '' ? $title : null;
        }

        if (isset($data['body'])) {
            ContentModeration::assertClean($data['body']);
            $post->body = trim($data['body']);
        }

        if (array_key_exists('is_anonymous', $data)) {
            $post->is_anonymous = (bool) $data['is_anonymous'];
        }

        if (! empty($data['remove_image']) && $post->image_path) {
            Storage::disk($this->disk())->delete($post->image_path);
            $post->image_path = null;
        }

        if ($request->hasFile('image')) {
            if ($post->image_path) {
                Storage::disk($this->disk())->delete($post->image_path);
            }

            $post->image_path = ImageOptimizer::storeOptimized($request->file('image'), 'flow-posts', $this->disk());
        }

        $images = $this->uploadedImages($request);
        $hasVideo = $request->hasFile('video');

        abort_if($hasVideo && ! empty($images), 422, 'Видео или фото — выберите что-то одно');

        if (! empty($data['remove_media']) || $hasVideo || ! empty($images)) {
            $this->deleteMedia($post);
            $this->storeMedia($post, $images, $hasVideo ? $request->file('video') : null);
        }

        $post->save();

        FlowHashtags::sync($post);

        return response()->json($this->serialize($post->refresh(), $user));
    }

    /**
     * Удалить пост.
     *
     * @param Request $request запрос
     * @param FlowPost $post пост
     */
    public function destroy(Request $request, FlowPost $post)
    {
        $user = $request->user();
        abort_unless((int) $user->id === (int) $post->user_id || $user->isAdmin(), 403);

        $tagIds = $post->tags()->pluck('tags.id')->map(fn ($id) => (int) $id)->all();
        $repostOfId = $post->repost_of_id ? (int) $post->repost_of_id : null;

        if ($post->image_path) {
            Storage::disk($this->disk())->delete($post->image_path);
        }

        $this->deleteMedia($post);

        $post->delete();

        $this->recountTags($tagIds);

        if ($repostOfId) {
            $root = FlowPost::find($repostOfId);

            if ($root) {
                $root->reposts_count = max(0, (int) $root->reposts_count - 1);
                $root->save();
            }
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Пересчитать счётчики тегов, пустые — удалить.
     *
     * @param array<int> $tagIds затронутые теги
     */
    private function recountTags(array $tagIds): void
    {
        foreach ($tagIds as $tagId) {
            $tag = \App\Models\Tag::find($tagId);

            if (! $tag) {
                continue;
            }

            $tag->forceFill(['posts_count' => $tag->flowPosts()->count()])->save();

            if ((int) $tag->posts_count === 0) {
                $tag->delete();
            }
        }
    }

    /**
     * Репост чужого поста себе на страницу (тихий или с цитатой).
     *
     * Создаёт лёгкую ссылку на корень цепочки (репост репоста
     * ссылается на оригинал, а не на репост): текст и картинка
     * не дублируются, карточка показывает оригинал как есть
     * с подписью «Репост от …» снизу. Автор оригинала получает
     * flow.reposted, подписчики — обычное sub_flow_post.
     *
     * @param Request $request запрос с опциональным comment
     * @param FlowPost $post оригинал или чужой репост
     */
    public function repost(Request $request, FlowPost $post)
    {
        $user = $request->user();

        $data = $request->validate([
            'comment' => 'nullable|string|max:500',
        ]);

        $post->loadMissing('user:id,name,profile_slug,avatar_path');

        abort_if((int) $post->user_id === (int) $user->id, 422, 'Это уже ваш пост');

        $this->abortIfBlocked($user, $post->user);

        if ($post->repost_of_id) {
            $root = FlowPost::findOrFail((int) $post->repost_of_id);
            $root->loadMissing('user:id,name,profile_slug,avatar_path');
        } else {
            $root = $post;
        }

        abort_if((int) $root->user_id === (int) $user->id, 422, 'Это уже ваш пост');

        $comment = trim((string) ($data['comment'] ?? ''));

        if ($comment !== '') {
            ContentModeration::assertClean($comment);
        }

        $repost = FlowPost::create([
            'user_id' => $user->id,
            'repost_of_id' => $root->id,
            'repost_comment' => $comment !== '' ? mb_substr($comment, 0, 500) : null,
            'title' => null,
            'body' => '',
            'image_path' => null,
            'is_anonymous' => false,
        ]);

        $root->increment('reposts_count');

        try {
            FlowPostNotifier::postCreated($repost->refresh());
        } catch (\Throwable) {
        }

        try {
            FlowPostNotifier::reposted($repost->refresh(), $root, $user);
        } catch (\Throwable) {
        }

        $payload = $this->serialize($repost->refresh(), $user);
        $reward = ActivityRewards::award($user, 'flow_repost', 'flow_post', $root->id);

        if ($reward !== null) {
            $payload['reward'] = $reward;
        }

        return response()->json($payload, 201);
    }

    /**
     * Лайк / анлайк поста.
     *
     * @param Request $request запрос
     * @param FlowPost $post пост
     */
    public function toggleLike(Request $request, FlowPost $post)
    {
        $viewer = $request->user();

        if ((int) $viewer->id !== (int) $post->user_id) {
            $this->abortIfBlocked($viewer, $post->user);
        }

        $existing = FlowPostLike::where('post_id', $post->id)
            ->where('user_id', $viewer->id)
            ->first();

        if ($existing) {
            $existing->delete();
            $post->decrement('likes_count');
            FlowPostNotifier::unliked($post->refresh(), $viewer);

            return response()->json([
                'liked' => false,
                'likes_count' => (int) $post->refresh()->likes_count,
            ]);
        }

        FlowPostLike::create(['post_id' => $post->id, 'user_id' => $viewer->id]);
        $post->increment('likes_count');
        FlowPostNotifier::liked($post->refresh(), $viewer);

        $response = [
            'liked' => true,
            'likes_count' => (int) $post->refresh()->likes_count,
        ];

        $isSelfLike = (int) $viewer->id === (int) $post->user_id;

        if (! $isSelfLike) {
            $reward = ActivityRewards::award($viewer, 'flow_like', 'flow_post', $post->id);

            if ($reward !== null) {
                $response['reward'] = $reward;
            }

            $author = $post->user;

            if ($author && (int) $author->id !== (int) $viewer->id) {
                ActivityRewards::award($author, 'flow_liked', 'flow_post', $post->id, (string) $viewer->id);
            }
        }

        return response()->json($response);
    }

    /**
     * Кто лайкнул пост: открытый список для тултипа и модалки.
     *
     * @param Request $request запрос
     * @param FlowPost $post пост
     * @return \Illuminate\Http\JsonResponse список лайков и общее число
     */
    public function likers(Request $request, FlowPost $post)
    {
        $viewer = $request->user();

        if ((int) $viewer->id !== (int) $post->user_id) {
            $this->abortIfBlocked($viewer, $post->user);
        }

        $likes = FlowPostLike::where('post_id', $post->id)
            ->with('user:id,name,profile_slug,avatar_path')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $list = $likes->map(function ($like) {
            $user = $like->user;

            return [
                'user_id' => $user?->id ?? $like->user_id,
                'name' => $user?->name ?? 'Пользователь',
                'profile_slug' => $user?->profile_slug,
                'avatar_url' => $user?->avatar_url,
            ];
        })->values();

        return response()->json([
            'likers' => $list,
            'total' => (int) $post->likes_count,
        ]);
    }
}
