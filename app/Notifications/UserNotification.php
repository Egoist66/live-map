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
     * Краткое фото для пейлоада (колокольчик показывает миниатюру сущности).
     *
     * @param \App\Models\ProfilePhoto $photo фото профиля
     * @return array{id:int,user_id:int,caption:string|null,url:string|null}
     */
    protected static function photoShape($photo): array
    {
        return [
            'id' => (int) $photo->id,
            'user_id' => (int) $photo->user_id,
            'caption' => $photo->caption,
            'url' => $photo->url,
        ];
    }

    /**
     * Краткий пост UFlow для пейлоада (колокольчик показывает миниатюру картинки).
     *
     * @param \App\Models\FlowPost $post пост ленты
     * @return array{id:int,user_id:int,image_url:string|null}
     */
    protected static function flowPostShape($post): array
    {
        return [
            'id' => (int) $post->id,
            'user_id' => (int) $post->user_id,
            'image_url' => $post->image_url,
        ];
    }

    /**
     * Краткий тред Pipe для пейлоада (диплинк на pipe.ulove.by).
     *
     * @param \App\Models\PipeThread|\App\Models\PipeReply $target тред или ответ
     * @return array{id:int,thread_id:int,url:string}
     */
    protected static function pipeThreadShape($target): array
    {
        if ($target instanceof \App\Models\PipeThread) {
            return [
                'id' => (int) $target->id,
                'thread_id' => (int) $target->id,
                'url' => route('pipe.show', ['thread' => $target->id]),
            ];
        }

        return [
            'id' => (int) $target->thread_id,
            'thread_id' => (int) $target->thread_id,
            'url' => route('pipe.show', ['thread' => $target->thread_id]),
        ];
    }

    /**
     * Краткий актор для пейлоада.
     * Инкогнито скрывает и id: по уведомлению нельзя открыть анкету.
     *
     * Организации несут флаги account_type/is_organization/is_verified:
     * фронт по ним пишет «Организация», а не «Пользователь».
     */
    protected static function actorShape(User $actor, bool $incognito = false): array
    {
        if ($incognito) {
            return ['id' => null, 'name' => 'Тайный поклонник', 'avatar_path' => null, 'avatar_url' => null];
        }

        $brief = null;

        try {
            $brief = $actor->businessBrief();
        } catch (\Throwable) {
            $brief = null;
        }

        return [
            'id' => $actor->id,
            'name' => $actor->name,
            'profile_slug' => $actor->profile_slug,
            'avatar_path' => $actor->avatar_path,
            'avatar_url' => $actor->avatar_url,
            'account_type' => $actor->account_type ?? 'person',
            'is_business' => $actor->isBusinessAccount(),
            'is_organization' => (bool) ($brief['is_organization'] ?? false),
            'is_verified' => (bool) ($brief['is_verified'] ?? false),
        ];
    }

    /**
     * Слово-субъект для текстов уведомлений: организация или пользователь.
     *
     * Организации (ООО/ИП — is_organization) именуются «Организация»,
     * все остальные — «Пользователь».
     *
     * @param User|array<string, mixed>|null $actor актор из пейлоада
     * @return string Организация|Пользователь
     */
    public static function subjectWord($actor): string
    {
        try {
            if ($actor instanceof User) {
                $brief = $actor->businessBrief();

                return ! empty($brief['is_organization']) ? 'Организация' : 'Пользователь';
            }

            if (is_array($actor) && ! empty($actor['is_organization'])) {
                return 'Организация';
            }

            if (is_array($actor) && ($actor['account_type'] ?? 'person') === 'business' && ! array_key_exists('is_organization', $actor)) {
                return 'Организация';
            }
        } catch (\Throwable) {
        }

        return 'Пользователь';
    }

    /**
     * Короткий анонс текста для excerpt. Public: сервисы (PipeNotifier
     * и др.) собирают свои activity-пейлоады этим же хелпером.
     */
    public static function excerpt(?string $content, int $limit = 120): ?string
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
