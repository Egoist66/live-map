<?php

namespace App\Http\Controllers;

use App\Models\Pin;
use App\Models\PinComment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PinCommentController extends Controller
{
    public function index(Pin $pin)
    {
        $comments = $pin->comments()->with('user:id,name,avatar_path')->with('replies.user:id,name')->latest()->paginate(20);
        $comments->getCollection()->transform(function ($c) {
            if ($c->is_anonymous) $c->setRelation('user', null);
            if ($c->relationLoaded('replies')) {
                $c->replies->each(fn($r) => $r->is_anonymous ? $r->setRelation('user', null) : null);
            }
            return $c;
        });
        return $comments;
    }

    public function store(Request $request, Pin $pin)
    {
        $data = $request->validate([
            'content' => 'required|string|max:1000',
            'parent_id' => 'nullable|exists:pin_comments,id',
            'is_anonymous' => 'sometimes|boolean',
        ]);
        $comment = $pin->comments()->create([
            'user_id' => $request->user()->id,
            'parent_id' => $data['parent_id'] ?? null,
            'content' => $data['content'],
            'is_anonymous' => $data['is_anonymous'] ?? $request->user()->is_anonymous_default ?? false,
        ]);
        $pin->increment('comments_count');
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
        $comment->update(['content' => $data['content']]);
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
        $comment->delete();
        $comment->pin()->decrement('comments_count');
        return response()->json(['ok' => true]);
    }
}
