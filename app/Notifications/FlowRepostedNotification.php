<?php

namespace App\Notifications;

use App\Models\FlowPost;
use App\Models\User;

/**
 * Репост поста в UFlow (автору оригинала).
 */
class FlowRepostedNotification extends UserNotification
{
    public function __construct(
        private FlowPost $repost,
        private FlowPost $root,
        private User $actor,
        private int $ownerId,
    ) {}

    public function type(): string { return 'flow.reposted'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string
    {
        return "flow-repost:{$this->root->id}:{$this->actor->id}";
    }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'flow_repost', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'flow_post_id' => $this->repost->id,
                'excerpt' => $this->repost->repost_comment
                    ? static::excerpt($this->repost->repost_comment)
                    : null,
                'flow_post' => static::flowPostShape($this->repost),
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $name = $this->actor->name ?: 'Кто-то';

        return [
            'title' => 'Репост',
            'body' => "{$name} поделился вашим постом в UFlow",
            'url' => '/flow/post/'.$this->repost->id,
            'tag' => "flow-{$this->root->id}-repost-{$this->actor->id}",
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
