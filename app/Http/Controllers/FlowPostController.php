<?php

namespace App\Http\Controllers;

use App\Models\FlowPost;
use App\Models\FlowPostLike;
use App\Models\UserBlock;
use App\Services\ContentModeration;
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
        abort_unless($owner->isDiscoverableBy($viewer), 404);
    }

    /**
     * Сериализация поста для ленты.
     *
     * @param FlowPost $post пост
     * @param \App\Models\User|null $viewer смотрящий
     */
    private function serialize(FlowPost $post, $viewer): array
    {
        $post->loadMissing('user:id,name,avatar_path');

        $author = $post->user;
        $isOwn = $viewer && (int) $viewer->id === (int) $post->user_id;
        $canSeeAuthor = ! $post->is_anonymous || $isOwn || ($viewer && $viewer->isAdmin());

        $liked = false;
        if ($viewer) {
            $liked = FlowPostLike::where('post_id', $post->id)
                ->where('user_id', $viewer->id)
                ->exists();
        }

        return [
            'id' => $post->id,
            'title' => $post->title,
            'body' => $post->body,
            'image_url' => $post->image_url,
            'is_anonymous' => (bool) $post->is_anonymous,
            'likes_count' => (int) $post->likes_count,
            'comments_count' => (int) $post->comments_count,
            'liked' => $liked,
            'can_edit' => $isOwn || ($viewer && $viewer->isAdmin()),
            'can_delete' => $isOwn || ($viewer && $viewer->isAdmin()),
            'created_at' => $post->created_at?->toISOString(),
            'updated_at' => $post->updated_at?->toISOString(),
            'author' => $canSeeAuthor && $author ? [
                'id' => $author->id,
                'name' => $author->name,
                'avatar_url' => $author->avatar_url,
            ] : [
                'id' => null,
                'name' => 'Аноним',
                'avatar_url' => null,
            ],
        ];
    }

    /**
     * Лента постов: все / подписки / мои / автора.
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
        ]);

        $filter = $data['filter'] ?? 'all';
        $query = FlowPost::with('user:id,name,avatar_path')->latest();

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

        $posts = $query->paginate(10);

        $posts->getCollection()->transform(fn ($post) => $this->serialize($post, $viewer));

        return $posts;
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
            'is_anonymous' => 'sometimes|boolean',
        ]);

        ContentModeration::assertClean($data['title'] ?? null, $data['body']);

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

        try {
            FlowPostNotifier::postCreated($post->refresh());
        } catch (\Throwable) {
        }

        return response()->json($this->serialize($post->refresh(), $user), 201);
    }

    /**
     * Обновить свой пост.
     *
     * @param Request $request запрос
     * @param FlowPost $post пост
     */
    public function update(Request $request, FlowPost $post)
    {
        $user = $request->user();
        abort_unless((int) $user->id === (int) $post->user_id || $user->isAdmin(), 403);

        $data = $request->validate([
            'title' => 'sometimes|nullable|string|max:150',
            'body' => 'sometimes|string|max:2000',
            'image' => 'nullable|image|max:10240',
            'remove_image' => 'sometimes|boolean',
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

        $post->save();

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

        if ($post->image_path) {
            Storage::disk($this->disk())->delete($post->image_path);
        }

        $post->delete();

        return response()->json(['ok' => true]);
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

        return response()->json([
            'liked' => true,
            'likes_count' => (int) $post->refresh()->likes_count,
        ]);
    }
}
