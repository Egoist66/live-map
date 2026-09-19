<?php

namespace App\Notifications;

use App\Models\User;

/**
 * Итог недели по очкам активности (понедельничная рассылка).
 *
 * Получает каждый, кто заработал очки за прошлую неделю: сколько
 * нафармил, текущий ранг и титул. Обновлённый уровень и титул
 * в профиле при этом уже свежие — очки капали сразу за действия.
 */
class WeeklyRewardsRecapNotification extends UserNotification
{
    public function __construct(
        private User $user,
        private int $earned,
        private string $weekKey,
        private string $levelName,
        private int $score,
    ) {}

    public function type(): string { return 'rewards.weekly'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'rewards-weekly:'.$this->weekKey; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'rewards_weekly', (int) $this->user->id, [
                'actor_id' => $this->user->id,
                'excerpt' => 'За неделю +'.$this->earned.' ★ · '.$this->levelName.' ('.$this->score.' очков)',
                'actor' => static::actorShape($this->user->fresh() ?? $this->user),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Итог недели: +'.$this->earned.' ★',
            'body' => $this->levelName.' · всего '.$this->score.' очков. Так держать!',
            'url' => '/profile/edit',
            'tag' => 'rewards-weekly-'.$this->weekKey,
            'avatar' => $this->user->avatar_url,
        ];
    }
}
