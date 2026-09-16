<?php

namespace App\Notifications;

use App\Models\District;
use App\Models\DistrictPost;
use App\Models\User;

/**
 * Лайк новости района (автору новости).
 */
class DistrictPostLikedNotification extends UserNotification
{
    public function __construct(
        private District $district,
        private DistrictPost $post,
        private User $actor,
        private int $ownerId,
    ) {}

    public function type(): string { return 'district.post_liked'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string
    {
        return 'district-post-like:'.$this->post->id.':'.$this->actor->id;
    }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'district_post_like', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'actor' => static::actorShape($this->actor),
            ]),
            'district' => [
                'id' => $this->district->id,
                'name' => $this->district->name,
                'post_id' => $this->post->id,
                'post_title' => $this->post->title,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Лайк в «'.$this->district->name.'»',
            'body' => $this->actor->name.' оценил(а) новость',
            'url' => '/districts/'.$this->district->id,
            'tag' => 'district-post-like-'.$this->post->id,
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
