<?php

namespace App\Http\Controllers;

use App\Models\Pin;
use App\Models\PinComment;
use Illuminate\Http\Request;

class PinCommentController extends Controller
{
    public function index(Pin $pin)
    {
        return $pin->comments()->with('user:id,name,avatar_path')->with('replies.user:id,name')->latest()->paginate(20);
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
            'is_anonymous' => $data['is_anonymous'] ?? false,
        ]);
        $pin->increment('comments_count');
        return response()->json($comment->load('user:id,name'), 201);
    }

    public function destroy(PinComment $comment)
    {
        $this->authorize('delete', $comment);
        $comment->delete();
        $comment->pin()->decrement('comments_count');
        return response()->json(['ok' => true]);
    }
}
