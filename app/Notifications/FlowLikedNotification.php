<?php

namespace App\Notifications;

use App\Models\FlowPost;
use App\Models\User;

/**
 * Лайк поста в UFlow (владельцу поста).
 */
class FlowLikedNotification extends UserNotification
{
    public function __construct(
        private FlowPost $post,
        private User $actor,
        private int $ownerId,
    ) {}

    public function type(): string { return 'flow.liked'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string
    {
        return "flow-like:{$this->post->id}:{$this->actor->id}";
    }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'flow_like', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'flow_post_id' => $this->post->id,
                'flow_post' => static::flowPostShape($this->post),
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $name = $this->actor->name ?: 'Кто-то';

        return [
            'title' => 'Новый лайк',
            'body' => "{$name} оценил ваш пост в UFlow",
            'url' => '/flow/post/'.$this->post->id,
            'tag' => "flow-{$this->post->id}-like-{$this->actor->id}",
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
