<?php

namespace App\Http\Controllers;

use App\Events\DistrictUpdated;
use App\Models\District;
use App\Models\DistrictPost;
use App\Models\DistrictPostComment;
use App\Services\ActivityRewards;
use App\Services\ContentModeration;
use App\Services\DistrictNotifier;
use Illuminate\Http\Request;

/**
 * Комментарии новостей UDistrict: ветки через parent_id.
 *
 * Читать могут все, кто видит район. Писать — жители,
 * править — свой, удалять — автор, автор новости,
 * владелец района или админ.
 */
class DistrictPostCommentController extends Controller
{
    /**
     * Сериализация комментария с ветками.
     *
     * @param DistrictPostComment $comment комментарий
     * @param \App\Models\User|null $viewer смотрящий
     * @return array<string,mixed>
     */
    private function serialize(DistrictPostComment $comment, $viewer): array
    {
        $comment->loadMissing('user:id,name,avatar_path');

        $author = $comment->user;
        $viewerId = $viewer ? (int) $viewer->id : 0;
        $post = $comment->post;

        $isAuthor = $viewerId > 0 && $viewerId === (int) $comment->user_id;
        $isPostAuthor = $viewerId > 0 && $post && $viewerId === (int) $post->user_id;

        $payload = [
            'id' => $comment->id,
            'post_id' => $comment->post_id,
            'parent_id' => $comment->parent_id,
            'content' => $comment->content,
            'can_edit' => $isAuthor,
            'can_delete' => $isAuthor || $isPostAuthor || ($viewer && $viewer->isAdmin()),
            'created_at' => $comment->created_at?->toISOString(),
            'updated_at' => $comment->updated_at?->toISOString(),
            'author' => $author ? [
                'id' => $author->id,
                'name' => $author->name,
                'avatar_url' => $author->avatar_url,
            ] : [
                'id' => null,
                'name' => 'Житель',
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
     * Найти новость внутри района.
     *
     * @param District $district район
     * @param int $postId новость
     * @return DistrictPost
     */
    private function findPost(District $district, int $postId): DistrictPost
    {
        return DistrictPost::where('district_id', $district->id)->findOrFail($postId);
    }

    /**
     * Найти комментарий внутри новости района.
     *
     * @param DistrictPost $post новость
     * @param int $commentId комментарий
     * @return DistrictPostComment
     */
    private function findComment(DistrictPost $post, int $commentId): DistrictPostComment
    {
        return DistrictPostComment::where('post_id', $post->id)->findOrFail($commentId);
    }

    /**
     * Ветки комментариев новости.
     *
     * @param Request $request запрос
     * @param District $district район
     * @param int $postId новость
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request, District $district, int $postId)
    {
        $viewer = $request->user();
        $post = $this->findPost($district, $postId);

        $comments = $post->comments()
            ->whereNull('parent_id')
            ->with(['user:id,name,avatar_path', 'replies' => fn ($query) => $query->oldest()->with('user:id,name,avatar_path')])
            ->oldest()
            ->paginate(20);

        $comments->getCollection()->transform(fn ($comment) => $this->serialize($comment, $viewer));

        return response()->json($comments);
    }

    /**
     * Написать комментарий или ответ (только жители).
     *
     * @param Request $request запрос
     * @param District $district район
     * @param int $postId новость
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request, District $district, int $postId)
    {
        $viewer = $request->user();
        abort_unless($district->isResident($viewer->id) || $viewer->isAdmin(), 403, 'Комментировать могут только жители района.');

        $post = $this->findPost($district, $postId);

        $data = $request->validate([
            'content' => 'required|string|max:1000',
            'parent_id' => 'nullable|integer|exists:district_post_comments,id',
        ]);

        ContentModeration::assertClean($data['content']);

        $parent = null;

        if (! empty($data['parent_id'])) {
            $parent = DistrictPostComment::whereKey($data['parent_id'])->where('post_id', $post->id)->first();
            abort_unless($parent, 422, 'Комментарий для ответа не найден');
        }

        $comment = $post->comments()->create([
            'user_id' => $viewer->id,
            'parent_id' => $parent?->id,
            'content' => trim($data['content']),
        ]);

        $post->increment('comments_count');
        broadcast(new DistrictUpdated($district))->toOthers();

        DistrictNotifier::postCommented($post->refresh(), $viewer, $comment->refresh());

        $payload = $this->serialize($comment->refresh(), $viewer);
        $reward = ActivityRewards::award($viewer, 'district_comment', 'district_post', $post->id);

        if ($reward !== null) {
            $payload['reward'] = $reward;
        }

        return response()->json($payload, 201);
    }

    /**
     * Править свой комментарий.
     *
     * @param Request $request запрос
     * @param District $district район
     * @param int $postId новость
     * @param int $commentId комментарий
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, District $district, int $postId, int $commentId)
    {
        $user = $request->user();
        $post = $this->findPost($district, $postId);
        $comment = $this->findComment($post, $commentId);

        abort_unless((int) $user->id === (int) $comment->user_id, 403);

        $data = $request->validate(['content' => 'required|string|max:1000']);
        ContentModeration::assertClean($data['content']);

        $comment->update(['content' => trim($data['content'])]);

        return response()->json($this->serialize($comment->refresh(), $user));
    }

    /**
     * Удалить комментарий с ответами.
     *
     * @param Request $request запрос
     * @param District $district район
     * @param int $postId новость
     * @param int $commentId комментарий
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, District $district, int $postId, int $commentId)
    {
        $user = $request->user();
        $post = $this->findPost($district, $postId);
        $comment = $this->findComment($post, $commentId);

        $isAuthor = (int) $user->id === (int) $comment->user_id;
        $isPostAuthor = (int) $user->id === (int) $post->user_id;
        $isDistrictOwner = (int) $user->id === (int) $district->user_id;

        abort_unless($isAuthor || $isPostAuthor || $isDistrictOwner || $user->isAdmin(), 403);

        $removed = 1 + $comment->replies()->count();
        $comment->replies()->delete();
        $comment->delete();
        $post->decrement('comments_count', $removed);
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true]);
    }
}
