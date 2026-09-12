<?php

namespace App\Notifications;

use App\Models\FlowPost;
use App\Models\FlowPostComment;
use App\Models\User;

/**
 * Ответ на комментарий в UFlow (автору родительского комментария).
 */
class FlowRepliedNotification extends UserNotification
{
    public function __construct(
        private FlowPost $post,
        private User $actor,
        private FlowPostComment $comment,
        private int $ownerId,
    ) {}

    public function type(): string { return 'flow.replied'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'flow-reply:'.$this->comment->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'flow_reply', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'flow_post_id' => $this->post->id,
                'flow_comment_id' => $this->comment->id,
                'excerpt' => static::excerpt($this->comment->content),
                'flow_post' => ['id' => $this->post->id, 'user_id' => $this->post->user_id],
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }
}
