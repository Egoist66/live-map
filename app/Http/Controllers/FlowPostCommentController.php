<?php

namespace App\Http\Controllers;

use App\Models\FlowPost;
use App\Models\FlowPostComment;
use App\Models\UserBlock;
use App\Services\ContentModeration;
use App\Services\FlowPostNotifier;
use App\Services\Mentions;
use Illuminate\Http\Request;

/**
 * Комментарии UFlow: чтение всеми, ответы через parent_id.
 */
class FlowPostCommentController extends Controller
{
    /**
     * Проверить блокировки между смотрящим и автором поста.
     *
     * @param \App\Models\User $viewer смотрящий
     * @param \App\Models\User $owner автор поста
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
     * Сериализация комментария с учётом анонимности.
     *
     * @param FlowPostComment $comment комментарий
     * @param \App\Models\User|null $viewer смотрящий
     */
    private function serialize(FlowPostComment $comment, $viewer): array
    {
        $comment->loadMissing('user:id,name,avatar_path');

        $isOwn = $viewer && (int) $viewer->id === (int) $comment->user_id;
        $canSeeAuthor = ! $comment->is_anonymous || $isOwn || ($viewer && $viewer->isAdmin());

        $author = $comment->user;

        $payload = [
            'id' => $comment->id,
            'post_id' => $comment->post_id,
            'parent_id' => $comment->parent_id,
            'content' => $comment->content,
            'is_anonymous' => (bool) $comment->is_anonymous,
            'can_edit' => $isOwn,
            'can_delete' => $isOwn || ($viewer && $viewer->isAdmin()),
            'created_at' => $comment->created_at?->toISOString(),
            'updated_at' => $comment->updated_at?->toISOString(),
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

        if ($comment->relationLoaded('replies')) {
            $replies = $comment->replies->map(fn ($reply) => $this->serialize($reply, $viewer))->values();
            $payload['replies'] = $replies;
            $payload['replies_count'] = $replies->count();
        }

        return $payload;
    }

    /**
     * Список комментариев поста.
     *
     * @param Request $request запрос
     * @param FlowPost $post пост
     */
    public function index(Request $request, FlowPost $post)
    {
        $viewer = $request->user();

        if ((int) $viewer->id !== (int) $post->user_id) {
            $this->abortIfBlocked($viewer, $post->user);
        }

        $comments = $post->comments()
            ->whereNull('parent_id')
            ->with(['user:id,name,avatar_path', 'replies' => fn ($query) => $query->oldest()->with('user:id,name,avatar_path')])
            ->oldest()
            ->paginate(20);

        $comments->getCollection()->transform(fn ($comment) => $this->serialize($comment, $viewer));

        return $comments;
    }

    /**
     * Создать комментарий или ответ.
     *
     * @param Request $request запрос
     * @param FlowPost $post пост
     */
    public function store(Request $request, FlowPost $post)
    {
        $viewer = $request->user();

        if ((int) $viewer->id !== (int) $post->user_id) {
            $this->abortIfBlocked($viewer, $post->user);
        }

        $data = $request->validate([
            'content' => 'required|string|max:1000',
            'parent_id' => 'nullable|integer|exists:flow_post_comments,id',
            'is_anonymous' => 'sometimes|boolean',
        ]);

        ContentModeration::assertClean($data['content']);

        $parent = null;
        if (! empty($data['parent_id'])) {
            $parent = FlowPostComment::whereKey($data['parent_id'])
                ->where('post_id', $post->id)
                ->first();

            abort_unless($parent, 422, 'Комментарий для ответа не найден');
        }

        $comment = $post->comments()->create([
            'user_id' => $viewer->id,
            'parent_id' => $parent?->id,
            'content' => trim($data['content']),
            'is_anonymous' => (bool) ($data['is_anonymous'] ?? $viewer->is_anonymous_default ?? false),
        ]);

        $post->increment('comments_count');

        $mentionedIds = Mentions::extractIds($data['content'], $viewer->id);
        FlowPostNotifier::commented($post->refresh(), $viewer, $comment->refresh());
        FlowPostNotifier::mentions($post, $viewer, $comment, $mentionedIds);

        return response()->json($this->serialize($comment->refresh(), $viewer), 201);
    }

    /**
     * Обновить свой комментарий. Чужой запрещено даже админу.
     *
     * @param Request $request запрос
     * @param FlowPostComment $comment комментарий
     */
    public function update(Request $request, FlowPostComment $comment)
    {
        $user = $request->user();
        abort_unless((int) $user->id === (int) $comment->user_id, 403);

        $data = $request->validate(['content' => 'required|string|max:1000']);
        ContentModeration::assertClean($data['content']);

        $comment->update(['content' => trim($data['content'])]);

        return response()->json($this->serialize($comment->refresh(), $user));
    }

    /**
     * Удалить комментарий вместе с ответами.
     *
     * @param Request $request запрос
     * @param FlowPostComment $comment комментарий
     */
    public function destroy(Request $request, FlowPostComment $comment)
    {
        $user = $request->user();

        $isPostOwner = (int) $user->id === (int) $comment->post->user_id;
        $isAuthor = (int) $user->id === (int) $comment->user_id;
        abort_unless($isAuthor || $isPostOwner || $user->isAdmin(), 403);

        $post = $comment->post;
        $removed = 1 + $comment->replies()->count();
        $comment->replies()->delete();
        $comment->delete();
        $post->decrement('comments_count', $removed);

        return response()->json(['ok' => true]);
    }
}
