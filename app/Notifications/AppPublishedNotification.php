<?php

namespace App\Notifications;

use App\Models\AppUpdate;

/**
 * Опубликованная новость приложения (всем пользователям).
 */
class AppPublishedNotification extends UserNotification
{
    public function __construct(private AppUpdate $update) {}

    public function type(): string { return 'app.published'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'app:'.$this->update->id; }

    public function payload(string $id): array
    {
        $u = $this->update;

        return [
            'activity' => null,
            'update' => [
                'id' => $u->id,
                'title' => $u->title,
                'body' => $u->body,
                'version' => $u->version,
                'published_at' => $u->published_at?->toISOString(),
            ],
        ];
    }
}
