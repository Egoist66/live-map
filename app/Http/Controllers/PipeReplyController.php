<?php

namespace App\Http\Controllers;

use App\Models\PipeReply;
use App\Models\PipeThread;
use App\Services\PipeService;
use Illuminate\Http\Request;

/**
 * API ответов Pipe: ветка треда, создание (через parent_id), удаление.
 */
class PipeReplyController extends Controller
{
    /**
     * Ответы треда: верхний уровень с одним вложенным уровнем детей.
     *
     * @param Request $request запрос
     * @param PipeThread $thread тред
     */
    public function index(Request $request, PipeThread $thread)
    {
        $thread->loadMissing('user:id,name,is_admin');
        PipeService::abortIfBlocked($request->user(), $thread->user);

        $replies = $thread->replies()
            ->with(['user:id,name,avatar_path', 'children.user:id,name,avatar_path'])
            ->oldest()
            ->paginate(20);

        $replies->getCollection()->transform(function ($reply) use ($request) {
            return PipeService::serializeReply($reply, $request->user(), [], true);
        });

        return $replies;
    }

    /**
     * Создать ответ (на тред или на ответ через parent_id).
     *
     * @param Request $request запрос
     * @param PipeThread $thread тред
     */
    public function store(Request $request, PipeThread $thread)
    {
        $viewer = $request->user();

        $thread->loadMissing('user:id,name,is_admin');

        if ((int) $viewer->id !== (int) $thread->user_id) {
            PipeService::abortIfBlocked($viewer, $thread->user);
        }

        $data = $request->validate([
            'body' => 'required|string|max:'.config('pipe.reply_max_length'),
            'parent_id' => 'nullable|integer|exists:pipe_replies,id',
            'is_anonymous' => 'sometimes|boolean',
        ]);

        $parent = null;

        if (! empty($data['parent_id'])) {
            $parent = PipeReply::whereKey($data['parent_id'])
                ->where('thread_id', $thread->id)
                ->first();

            abort_unless($parent, 422, 'Ответ, на который вы отвечаете, не найден');

            $parent->loadMissing('user:id,name,is_admin');
            PipeService::abortIfBlocked($viewer, $parent->user);
        }

        $reply = PipeService::createReply($viewer, $thread, $data, $parent);

        return response()->json(PipeService::serializeReply($reply->refresh(), $viewer, [], false, $parent), 201);
    }

    /**
     * Удалить ответ (владелец или админ): счётчик треда честно откатывается.
     *
     * @param Request $request запрос
     * @param PipeReply $reply ответ
     */
    public function destroy(Request $request, PipeReply $reply)
    {
        $user = $request->user();
        $isOwner = (int) $user->id === (int) $reply->user_id;

        abort_unless($isOwner || $user->isAdmin(), 403);

        $thread = $reply->thread()->first();
        $reply->delete();

        if ($thread) {
            $thread->refresh();
            $liveRepliesCount = (int) $thread->allReplies()->count();
            $thread->replies_count = max(0, $liveRepliesCount);
            $thread->save();
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Лайк / анлайк ответа.
     *
     * @param Request $request запрос
     * @param PipeReply $reply ответ
     */
    public function toggleLike(Request $request, PipeReply $reply)
    {
        $reply->loadMissing('user:id,name,is_admin');

        if ((int) $request->user()->id !== (int) $reply->user_id) {
            PipeService::abortIfBlocked($request->user(), $reply->user);
        }

        return response()->json(PipeService::toggleLike($request->user(), $reply));
    }
}
