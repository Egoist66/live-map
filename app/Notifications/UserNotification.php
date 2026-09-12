<?php

namespace App\Notifications;

use App\Models\User;

/**
 * Базовое уведомление единой inbox-таблицы notifications.
 *
 * Каждое событие приложения — свой type (pin.commented, dating.matched,
 * friend.requested, security.impersonation, ...), вкладка колокольчика —
 * category (pin|event). Пейлоад data.activity повторяет форму PinActivity,
 * поэтому фронт (тосты, табы, диплинки) работает без изменений.
 */
abstract class UserNotification
{
    /**
     * Тип строки notifications.type, он же ключ фронта.
     */
    abstract public function type(): string;

    /**
     * Вкладка колокольчика: pin (таб «Пины») или event (таб «События»).
     */
    abstract public function category(): string;

    /**
     * Ключ идемпотентности в пределах получателя.
     * Повтор с тем же ключом поднимает запись наверх, а не плодит дубли.
     */
    abstract public function dedupeKey(): ?string;

    /**
     * Пейлоад колонки data (строится под готовый id строки).
     *
     * @param string $id uuid создаваемой строки
     */
    abstract public function payload(string $id): array;

    /**
     * Системный web-push (null — не слать, достаточно realtime-тоста).
     *
     * @return array{title:string,body:string,url:string,tag:string,avatar:string|null}|null
     */
    public function pushPayload(): ?array
    {
        return null;
    }

    /**
     * Каркас activity-пейлоада в форме PinActivity::toNotifyArray().
     */
    protected static function activityShape(string $id, string $kind, int $ownerId, array $over = []): array
    {
        $base = [
            'id' => $id,
            'kind' => $kind,
            'owner_id' => $ownerId,
            'reaction_type' => null,
            'excerpt' => null,
            'comment_id' => null,
            'photo_comment_id' => null,
            'flow_post_id' => null,
            'flow_comment_id' => null,
            'related_user_id' => null,
            'is_incognito' => false,
            'read_at' => null,
            'created_at' => now()->toISOString(),
            'pin' => null,
            'photo' => null,
            'flow_post' => null,
            'actor' => null,
        ];

        return array_merge($base, $over);
    }

    /**
     * Краткий актор для пейлоада.
     */
    protected static function actorShape(User $actor, bool $incognito = false): array
    {
        if ($incognito) {
            return ['id' => $actor->id, 'name' => 'Тайный поклонник', 'avatar_path' => null, 'avatar_url' => null];
        }

        return [
            'id' => $actor->id,
            'name' => $actor->name,
            'avatar_path' => $actor->avatar_path,
            'avatar_url' => $actor->avatar_url,
        ];
    }

    /**
     * Короткий анонс текста для excerpt.
     */
    protected static function excerpt(?string $content, int $limit = 120): ?string
    {
        $clean = trim((string) preg_replace('/\s+/', ' ', (string) $content));
        if ($clean === '') {
            return null;
        }
        if (mb_strlen($clean) > $limit) {
            $clean = mb_substr($clean, 0, $limit - 3).'...';
        }

        return $clean;
    }
}
