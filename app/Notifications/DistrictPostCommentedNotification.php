<?php

namespace App\Notifications;

use App\Models\District;
use App\Models\DistrictPost;
use App\Models\DistrictPostComment;
use App\Models\User;

/**
 * Комментарий к новости района (автору новости).
 */
class DistrictPostCommentedNotification extends UserNotification
{
    public function __construct(
        private District $district,
        private DistrictPost $post,
        private User $actor,
        private DistrictPostComment $comment,
        private int $ownerId,
    ) {}

    public function type(): string { return 'district.post_commented'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string
    {
        return 'district-post-comment:'.$this->comment->id;
    }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'district_post_comment', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'comment_id' => $this->comment->id,
                'excerpt' => static::excerpt($this->comment->content),
                'actor' => static::actorShape($this->actor),
            ]),
            'district' => [
                'id' => $this->district->id,
                'name' => $this->district->name,
                'post_id' => $this->post->id,
                'comment_id' => $this->comment->id,
                'excerpt' => static::excerpt($this->comment->content),
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Комментарий в «'.$this->district->name.'»',
            'body' => $this->actor->name.': '.mb_substr(trim((string) $this->comment->content), 0, 80),
            'url' => '/districts/'.$this->district->id,
            'tag' => 'district-post-comment-'.$this->comment->id,
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
