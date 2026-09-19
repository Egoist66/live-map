<?php

namespace App\Services;

use App\Models\FlowPoll;
use App\Models\FlowPollOption;
use App\Models\FlowPollVote;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Голосование в опросах UFlow: один голос пользователя на опрос.
 *
 * Создание опроса — в FlowPostController::store вместе с постом,
 * здесь только голос, смена голоса запрещена (как в Threads),
 * закрытие — автором или админом.
 */
class FlowPollService
{
    /**
     * Проголосовать за вариант.
     *
     * @param FlowPoll $poll опрос
     * @param User $voter голосующий
     * @param int $optionId вариант
     * @throws ValidationException закрыт, повторный голос или чужой вариант
     */
    public static function vote(FlowPoll $poll, User $voter, int $optionId): FlowPollVote
    {
        abort_if($poll->isClosed(), 422, 'Опрос закрыт');

        $exists = FlowPollVote::where('poll_id', $poll->id)
            ->where('user_id', $voter->id)
            ->exists();

        abort_if($exists, 422, 'Вы уже проголосовали');

        $option = FlowPollOption::where('poll_id', $poll->id)
            ->whereKey($optionId)
            ->first();

        abort_if(! $option, 422, 'Вариант не найден');

        $vote = FlowPollVote::create([
            'poll_id' => $poll->id,
            'option_id' => $option->id,
            'user_id' => $voter->id,
        ]);

        $option->increment('votes_count');
        $poll->increment('total_votes');

        return $vote;
    }

    /**
     * Закрыть опрос досрочно (автор поста или админ).
     *
     * @param FlowPoll $poll опрос
     */
    public static function close(FlowPoll $poll): void
    {
        $poll->forceFill(['closed' => true])->save();
    }

    /**
     * Проводной формат опроса для ленты.
     *
     * @param FlowPoll $poll опрос с подгруженными вариантами
     * @param User|null $viewer смотрящий
     * @param array<int,int> $votesMap poll_id => option_id (батч для ленты)
     */
    public static function serialize(FlowPoll $poll, $viewer, array $votesMap = []): array
    {
        $poll->loadMissing('options');

        $options = $poll->options
            ->map(fn ($option) => [
                'id' => (int) $option->id,
                'text' => $option->text,
                'votes_count' => (int) $option->votes_count,
            ])
            ->values()
            ->all();

        $votedId = null;

        if ($viewer) {
            if (array_key_exists((int) $poll->id, $votesMap)) {
                $votedId = (int) $votesMap[(int) $poll->id];
            } else {
                $votedId = FlowPollVote::where('poll_id', $poll->id)
                    ->where('user_id', $viewer->id)
                    ->value('option_id');

                $votedId = $votedId ? (int) $votedId : null;
            }
        }

        return [
            'id' => (int) $poll->id,
            'closed' => $poll->isClosed(),
            'closes_at' => $poll->closes_at?->toISOString(),
            'total_votes' => (int) $poll->total_votes,
            'voted_option_id' => $votedId,
            'options' => $options,
        ];
    }
}
