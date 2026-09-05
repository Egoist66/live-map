<?php

namespace App\Http\Controllers;

use App\Models\Pin;
use App\Models\PinComment;
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
        return $comments;
    }

    public function store(Request $request, Pin $pin)
    {
        abort_unless($pin->isVisibleForGender($request->user()), 403, 'Пин доступен только для другого пола');
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
        PinActivityNotifier::comment($pin, $request->user(), $comment);
        PinActivityNotifier::mentions($pin, $request->user(), $comment, Mentions::extractIds($data['content'], $request->user()->id));
        if ($comment->is_anonymous) $comment->setRelation('user', null);
        else $comment->load('user:id,name,avatar_path');
        return response()->json($comment, 201);
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
        if (!$user->isAdmin()) {
            $key = "comment_edit:{$user->id}:{$comment->pin_id}:" . now()->toDateString();
            Cache::put($key, ((int) Cache::get($key, 0)) + 1, now()->endOfDay());
        }
        $comment->load('user:id,name,avatar_path');
        if ($comment->is_anonymous) $comment->setRelation('user', null);
        return response()->json($comment);
    }

    public function destroy(PinComment $comment)
    {
        $this->authorize('delete', $comment);
        $pin = $comment->pin;
        $removed = 1 + $comment->replies()->count();
        $comment->replies()->delete();
        $comment->delete();
        $pin->decrement('comments_count', $removed);
        PinActivityNotifier::counters($pin);
        return response()->json(['ok' => true]);
    }
}
