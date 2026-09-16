<?php

namespace App\Notifications;

use App\Models\District;
use App\Models\DistrictPost;
use App\Models\User;

/**
 * Владелец опубликовал новость района (всем жителям, кроме автора).
 */
class DistrictPostPublishedNotification extends UserNotification
{
    public function __construct(
        private District $district,
        private DistrictPost $post,
        private User $actor,
        private int $ownerId,
    ) {}

    public function type(): string { return 'district.post_published'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string
    {
        return 'district-post:'.$this->post->id;
    }

    public function payload(string $id): array
    {
        $excerpt = static::excerpt($this->post->title.' '.$this->post->body);

        return [
            'activity' => static::activityShape($id, 'district_post', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'excerpt' => $excerpt,
                'actor' => static::actorShape($this->actor),
            ]),
            'district' => [
                'id' => $this->district->id,
                'name' => $this->district->name,
                'post_id' => $this->post->id,
                'post_title' => $this->post->title,
                'post_excerpt' => $excerpt,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $title = $this->post->title
            ? mb_substr(trim((string) $this->post->title), 0, 60)
            : mb_substr(trim((string) $this->post->body), 0, 60);

        return [
            'title' => 'Новость в «'.$this->district->name.'»',
            'body' => $this->actor->name.' — '.$title,
            'url' => '/districts/'.$this->district->id,
            'tag' => 'district-post-'.$this->post->id,
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
