<?php

namespace App\Http\Controllers;

use App\Models\Pin;
use App\Models\PinComment;
use App\Services\ActivityRewards;
use App\Services\ContentModeration;
use App\Services\Mentions;
use App\Services\PinActivityNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PinCommentController extends Controller
{
    public function index(Pin $pin)
    {
        abort_unless($pin->isVisibleForGender(request()->user()), 403, 'Пин доступен только для другого пола');
        abort_unless(\App\Services\PinVisibility::canView(request()->user(), $pin), 403, 'Пин вне вашей зоны или страны.');
        $comments = $pin->comments()
            ->whereNull('parent_id')
            ->with(['user:id,name,avatar_path', 'replies' => fn ($q) => $q->oldest()->with('user:id,name,avatar_path')])
            ->withCount('replies')
            ->latest()->paginate(20);
        $comments->getCollection()->transform(function ($c) {
            if ($c->is_anonymous) $c->setRelation('user', null);
            $c->replies->each(fn ($r) => $r->is_anonymous ? $r->setRelation('user', null) : null);
            return $c;
        });
        $comments->getCollection()->transform(function ($c) {
            $arr = $c->toArray();
            $arr['moderation'] = ContentModeration::flagsFor($c->content);
            foreach (($arr['replies'] ?? []) as $i => $reply) {
                $replyModel = $c->replies[$i] ?? null;
                $arr['replies'][$i]['moderation'] = ContentModeration::flagsFor($replyModel?->content ?? $reply['content'] ?? null);
            }
            return $arr;
        });
        return $comments;
    }

    public function store(Request $request, Pin $pin)
    {
        abort_unless($pin->isVisibleForGender($request->user()), 403, 'Пин доступен только для другого пола');
        abort_unless(\App\Services\PinVisibility::canView($request->user(), $pin), 403, 'Пин вне вашей зоны или страны.');
        $data = $request->validate([
            'content' => 'required|string|max:1000',
            'parent_id' => 'nullable|exists:pin_comments,id',
            'is_anonymous' => 'sometimes|boolean',
        ]);
        ContentModeration::assertClean($data['content']);
        $parent = null;
        if (!empty($data['parent_id'])) {
            $parent = PinComment::whereKey($data['parent_id'])->where('pin_id', $pin->id)->first();
            abort_unless($parent, 422, 'Комментарий для ответа не найден');
        }
        $comment = $pin->comments()->create([
            'user_id' => $request->user()->id,
            'parent_id' => $parent?->id,
            'content' => $data['content'],
            'is_anonymous' => $data['is_anonymous'] ?? $request->user()->is_anonymous_default ?? false,
        ]);
        $pin->increment('comments_count');
        $mentionedIds = Mentions::extractIds($data['content'], $request->user()->id);
        try {
            \App\Jobs\ModeratePublicContentJob::dispatch('pin_comment', (int) $comment->id, (int) $request->user()->id, (string) $data['content']);
        } catch (\Throwable) {
        }
        PinActivityNotifier::comment($pin, $request->user(), $comment, $mentionedIds);
        PinActivityNotifier::mentions($pin, $request->user(), $comment, $mentionedIds);
        \App\Events\CommentThreadUpdated::touch('pin', (int) $pin->id);
        if ($comment->is_anonymous) $comment->setRelation('user', null);
        else $comment->load('user:id,name,avatar_path');
        $payload = $comment->toArray();
        $payload['moderation'] = ContentModeration::flagsFor($comment->content);
        $reward = ActivityRewards::award($request->user(), 'pin_comment', 'pin', $pin->id);

        if ($reward !== null) {
            $payload['reward'] = $reward;
        }

        return response()->json($payload, 201);
    }

    public function update(Request $request, PinComment $comment)
    {
        $this->authorize('update', $comment);
        $user = $request->user();
        if (!$user->isAdmin()) {
            $key = "comment_edit:{$user->id}:{$comment->pin_id}:" . now()->toDateString();
            $cnt = (int) Cache::get($key, 0);
            if ($cnt >= 3) abort(429, 'Лимит 3 редактирований в день для этого пина');
        }
        $data = $request->validate(['content' => 'required|string|max:1000']);
        ContentModeration::assertClean($data['content']);
        $oldMentioned = Mentions::extractIds($comment->content, $user->id);
        $comment->update(['content' => $data['content']]);
        $newMentioned = array_diff(Mentions::extractIds($data['content'], $user->id), $oldMentioned);
        if ($newMentioned) PinActivityNotifier::mentions($comment->pin, $user, $comment->refresh(), array_values($newMentioned));
        \App\Events\CommentThreadUpdated::touch('pin', (int) $comment->pin_id);
        if (!$user->isAdmin()) {
            $key = "comment_edit:{$user->id}:{$comment->pin_id}:" . now()->toDateString();
            Cache::put($key, ((int) Cache::get($key, 0)) + 1, now()->endOfDay());
        }
        $comment->load('user:id,name,avatar_path');
        if ($comment->is_anonymous) $comment->setRelation('user', null);
        return response()->json($comment);
    }

    /**
     * Удалить комментарий вместе с ответами.
     *
     * Free-тариф: максимум 3 удаления своих комментариев в день,
     * на PRO и у админа — безлимитно.
     *
     * @param PinComment $comment
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(PinComment $comment)
    {
        $this->authorize('delete', $comment);
        $user = request()->user();
        $limited = !$user->isPro();
        $limitKey = "comment_delete:{$user->id}:" . now()->toDateString();
        if ($limited && (int) Cache::get($limitKey, 0) >= 3) {
            abort(429, 'Лимит удалений: 3 комментария в день на Free, на PRO — безлимитно.');
        }
        $pin = $comment->pin;
        $removed = 1 + $comment->replies()->count();
        $comment->replies()->delete();
        $comment->delete();
        $pin->decrement('comments_count', $removed);
        PinActivityNotifier::counters($pin);
        \App\Events\CommentThreadUpdated::touch('pin', (int) $pin->id);
        if ($limited) {
            Cache::put($limitKey, ((int) Cache::get($limitKey, 0)) + 1, now()->endOfDay());
        }

        return response()->json(['ok' => true]);
    }
}
