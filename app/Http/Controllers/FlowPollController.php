<?php

namespace App\Http\Controllers;

use App\Models\FlowPoll;
use App\Models\FlowPost;
use App\Services\ActivityRewards;
use App\Services\FlowPollService;
use Illuminate\Http\Request;

/**
 * Опросы UFlow: голосование и досрочное закрытие.
 *
 * Создание опроса — вместе с постом (FlowPostController::store),
 * здесь голос (один на пользователя) и закрытие автором/админом.
 */
class FlowPollController extends Controller
{
    /**
     * Проголосовать за вариант.
     *
     * @param Request $request запрос с option_id
     * @param FlowPoll $poll опрос
     */
    public function vote(Request $request, FlowPoll $poll)
    {
        $viewer = $request->user();

        $data = $request->validate([
            'option_id' => 'required|integer',
        ]);

        $poll->loadMissing('post');

        $post = $poll->post ?? FlowPost::findOrFail($poll->post_id);

        abort_unless($viewer->canCommentFlowPost($post->user), 403, 'Автор запретил комментировать пост');

        FlowPollService::vote($poll, $viewer, (int) $data['option_id']);

        $payload = FlowPollService::serialize($poll->refresh(), $viewer);
        $reward = ActivityRewards::award($viewer, 'poll_vote', 'flow_poll', $poll->id);

        if ($reward !== null) {
            $payload['reward'] = $reward;
        }

        return response()->json($payload);
    }

    /**
     * Закрыть опрос досрочно (автор поста или админ).
     *
     * @param Request $request запрос
     * @param FlowPoll $poll опрос
     */
    public function close(Request $request, FlowPoll $poll)
    {
        $viewer = $request->user();

        $poll->loadMissing('post');

        $post = $poll->post ?? FlowPost::findOrFail($poll->post_id);

        $isOwner = (int) $viewer->id === (int) $post->user_id;

        abort_unless($isOwner || $viewer->isAdmin(), 403);

        FlowPollService::close($poll);

        return response()->json(FlowPollService::serialize($poll->refresh(), $viewer));
    }
}
