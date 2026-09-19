<?php

namespace App\Notifications;

use App\Models\FlowPost;
use App\Models\User;

/**
 * Автор опубликовал пост в UFlow (подписчикам с флагом notify_post).
 */
class FlowPostedNotification extends UserNotification
{
    public function __construct(
        private FlowPost $post,
        private User $actor,
        private int $ownerId,
        private ?string $excerpt,
    ) {}

    public function type(): string { return 'flow.posted'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'flow-posted:'.$this->post->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'sub_flow_post', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'flow_post_id' => $this->post->id,
                'excerpt' => $this->excerpt,
                'flow_post' => static::flowPostShape($this->post),
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => $this->actor->name.' — новый пост в UFlow',
            'body' => $this->excerpt ?? 'Открыть ленту',
            'url' => '/flow/post/'.$this->post->id,
            'tag' => 'flow-posted-'.$this->post->id,
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
