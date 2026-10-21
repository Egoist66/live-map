<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\DatingMatch;
use App\Models\DatingReview;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Отзывы о пользователях знакомств: кто может, сводка, список, модерация.
 *
 * Оставить отзыв может только взаимодействовавший: мэтч или
 * direct-диалог (писал сам, писали ему, уже общаются). Один автор —
 * один отзыв. Отзыв обязательно несёт текст от BODY_MIN символов —
 * голая оценка не публикуется. Каждый новый/переписанный отзыв
 * сначала попадает в очередь модерации (status pending): админ или
 * модератор одобряет/отклоняет его в админке, и только после
 * одобрения сводка, профиль и карточки свайпов видят оценку.
 * Звёзды ставятся раз и навсегда: повторная отправка меняет только
 * текст, новую оценку примет только админ. Удаление своего отзыва
 * обычным пользователям запрещено — иначе заморозку звёзд обходили
 * бы через удалить/поставить заново. Скрытие рейтинга — привилегия
 * PRO и выше (dating_hide_rating): скрыт — сводка и список не
 * отдаются никому, кроме владельца.
 */
class DatingReviewService
{
    /**
     * Минимум текста отзыва, символов: отзыв раскрывает, за что оценка.
     */
    public const BODY_MIN = 50;

    /**
     * Максимум текста отзыва, символов.
     */
    public const BODY_LIMIT = 280;

    /**
     * Может ли автор оценить человека.
     *
     * Нельзя себя, заблокированных (в любую сторону), скрывших
     * рейтинг и тех, с кем не было ни мэтча, ни direct-диалога.
     * Админам можно всегда: модерация отзывов без возможности
     * посмотреть. Скрытие не ретроактивно: свой старый отзыв
     * удалить можно, новый поставить — нет.
     *
     * @param User $author кто оценивает
     * @param User $target кого оценивают
     * @return bool
     */
    public function canReview(User $author, User $target): bool
    {
        if ((int) $author->id === (int) $target->id) {
            return false;
        }

        if ((bool) ($target->dating_hide_rating ?? false) && ! $author->isAdmin()) {
            return false;
        }

        if ($author->isAdmin()) {
            return true;
        }

        $blocked = UserBlock::where(function ($query) use ($author, $target) {
            $query->where(function ($inner) use ($author, $target) {
                $inner->where('blocker_id', $author->id)->where('blocked_id', $target->id);
            })->orWhere(function ($inner) use ($author, $target) {
                $inner->where('blocker_id', $target->id)->where('blocked_id', $author->id);
            });
        })->exists();

        if ($blocked) {
            return false;
        }

        $low = min((int) $author->id, (int) $target->id);
        $high = max((int) $author->id, (int) $target->id);

        $matched = DatingMatch::where('user_a_id', $low)
            ->where('user_b_id', $high)
            ->exists();

        if ($matched) {
            return true;
        }

        return Conversation::findDirect((int) $author->id, (int) $target->id) !== null;
    }

    /**
     * Сводка рейтинга человека.
     *
     * Скрытый рейтинг (PRO+) отдаём только владельцу и админам:
     * остальным — null, чтобы звёзды не светились в ленте.
     *
     * @param User $target чей рейтинг
     * @param User|null $viewer кто смотрит (null — гость)
     * @return array{avg:float|null,count:int,hidden:bool}
     */
    public function summary(User $target, ?User $viewer = null): array
    {
        $hidden = (bool) ($target->dating_hide_rating ?? false);
        $isSelf = $viewer !== null && (int) $viewer->id === (int) $target->id;

        if ($hidden && ! $isSelf && ! ($viewer?->isAdmin() ?? false)) {
            return ['avg' => null, 'count' => 0, 'hidden' => true];
        }

        $aggregate = DatingReview::where('target_id', $target->id)
            ->where('status', DatingReview::STATUS_APPROVED)
            ->selectRaw('COUNT(*) as count, AVG(rating) as avg')
            ->first();

        $count = (int) ($aggregate->count ?? 0);

        if ($count === 0) {
            return ['avg' => null, 'count' => 0, 'hidden' => $hidden];
        }

        return ['avg' => round((float) $aggregate->avg, 1), 'count' => $count, 'hidden' => $hidden];
    }

    /**
     * Сводки сразу для пачки людей (лента свайпов без N+1).
     *
     * Скрытые отдаём пустыми всем, кроме самих владельцев:
     * в ленте чужое скрытое не показываем никогда.
     *
     * @param int[] $targetIds id людей
     * @param User|null $viewer кто смотрит
     * @return array<int, array{avg:float|null,count:int,hidden:bool}> по id
     */
    public function summariesFor(array $targetIds, ?User $viewer = null): array
    {
        $ids = array_values(array_unique(array_map('intval', $targetIds)));

        if ($ids === []) {
            return [];
        }

        $viewerId = $viewer !== null ? (int) $viewer->id : 0;
        $viewerIsAdmin = $viewer !== null && $viewer->isAdmin();

        $hiddenIds = [];

        if (! $viewerIsAdmin) {
            $hiddenIds = User::whereIn('id', $ids)
                ->where('dating_hide_rating', true)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        $rows = DatingReview::whereIn('target_id', $ids)
            ->where('status', DatingReview::STATUS_APPROVED)
            ->selectRaw('target_id, COUNT(*) as count, AVG(rating) as avg')
            ->groupBy('target_id')
            ->get();

        $result = [];

        foreach ($ids as $id) {
            $result[$id] = ['avg' => null, 'count' => 0, 'hidden' => in_array($id, $hiddenIds, true)];
        }

        foreach ($rows as $row) {
            $id = (int) $row->target_id;

            if (! isset($result[$id])) {
                continue;
            }

            if ($result[$id]['hidden'] && $id !== $viewerId) {
                continue;
            }

            $count = (int) $row->count;

            $result[$id]['count'] = $count;
            $result[$id]['avg'] = $count > 0 ? round((float) $row->avg, 1) : null;
        }

        return $result;
    }

    /**
     * Список отзывов о человеке (новые сверху).
     *
     * Только одобренные: pending/rejected в список не попадают.
     * Скрытый рейтинг видят только владелец и админы.
     * Автор подтягивается мини-профилем (имя, аватар).
     *
     * @param User $target о ком отзывы
     * @param User|null $viewer кто смотрит
     * @param int $perPage размер страницы
     * @return LengthAwarePaginator
     */
    public function listFor(User $target, ?User $viewer = null, int $perPage = 10): LengthAwarePaginator
    {
        $hidden = (bool) ($target->dating_hide_rating ?? false);
        $isSelf = $viewer !== null && (int) $viewer->id === (int) $target->id;

        abort_if($hidden && ! $isSelf && ! ($viewer?->isAdmin() ?? false), 403, 'Рейтинг скрыт владельцем');

        return DatingReview::where('target_id', $target->id)
            ->where('status', DatingReview::STATUS_APPROVED)
            ->with(['author:id,name,avatar_path,profile_slug'])
            ->latest('id')
            ->paginate($perPage);
    }

    /**
     * Создать отзыв или поправить текст своего.
     *
     * Звёзды заморожены: у кого отзыв уже есть, тот меняет только
     * текст — чужую оценку поверх примут лишь от админа. Текст
     * обязателен (минимум BODY_MIN символов) — голые оценки не
     * публикуем. Каждый отзыв до опубликования проходит модерацию:
     * статус ставится pending, и сводка/список его не видят, пока
     * админ или модератор не одобрит. Свои правки ранее одобренного
     * текста снова отправляют отзыв в модерацию. Персонал
     * (canModerate) публикуется сразу — кто модерацию ведёт,
     * того она не блокирует.
     *
     * @param User $author кто оценивает
     * @param User $target кого оценивают
     * @param int|null $rating звёзды 1–5 (null — только текст)
     * @param string|null $body текст
     * @return DatingReview
     */
    public function upsert(User $author, User $target, ?int $rating, ?string $body): DatingReview
    {
        abort_if(! $this->canReview($author, $target), 422, 'Отзыв можно оставить только после общения: мэтч или переписка');

        $existing = DatingReview::where('author_id', $author->id)
            ->where('target_id', $target->id)
            ->first();

        if ($existing !== null && ! $author->isAdmin()) {
            $locked = (int) $existing->rating;

            if ($rating !== null && $rating !== $locked) {
                abort(422, 'Звёзды уже поставлены — можно изменить только текст отзыва');
            }

            $rating = $locked;
        }

        if ($rating === null) {
            if ($existing !== null) {
                $rating = (int) $existing->rating;
            } else {
                abort(422, 'Поставьте оценку от 1 до 5');
            }
        }

        $clean = $body !== null ? trim((string) $body) : '';

        if (mb_strlen($clean) < self::BODY_MIN) {
            abort(422, 'Отзыв без комментария не принять: напиши '.self::BODY_MIN.'+ символов о человеке');
        }

        if (mb_strlen($clean) > self::BODY_LIMIT) {
            $clean = mb_substr($clean, 0, self::BODY_LIMIT);
        }

        ContentModeration::assertClean($clean);

        $staffPublish = (bool) $author->canModerate();

        $review = DatingReview::updateOrCreate(
            ['author_id' => $author->id, 'target_id' => $target->id],
            [
                'rating' => $rating,
                'body' => $clean,
                'status' => $staffPublish ? DatingReview::STATUS_APPROVED : DatingReview::STATUS_PENDING,
                'moderator_id' => $staffPublish ? $author->id : null,
                'moderated_at' => $staffPublish ? now() : null,
            ]
        );

        try {
            \App\Jobs\ModeratePublicContentJob::dispatch('dating_review', (int) $review->id, (int) $author->id, (string) $clean);
        } catch (\Throwable) {
        }

        if ($staffPublish) {
            $review->load(['author', 'target']);

            try {
                $this->approve($review, $author);
            } catch (\Throwable) {
            }
        }

        return $review;
    }

    /**
     * Одобрить отзыв из очереди модерации.
     *
     * Только после первого одобрения отправляются: уведомление
     * получателю, тг-пинг и штраф траст-скора за 1–2 звезды.
     * Повторное одобрение уже одобренного — просто фиксация решения.
     *
     * @param DatingReview $review отзыв с подгруженным автором и target
     * @param User $moderator кто одобрил
     * @return DatingReview
     */
    public function approve(DatingReview $review, User $moderator): DatingReview
    {
        $wasApproved = $review->isApproved();

        $review->forceFill([
            'status' => DatingReview::STATUS_APPROVED,
            'moderator_id' => $moderator->id,
            'moderated_at' => now(),
        ])->save();

        if ($wasApproved) {
            return $review->refresh();
        }

        $target = $review->target;
        $author = $review->author;

        if ((int) $review->rating <= 2 && $target !== null) {
            try {
                TrustScoreService::penalizeBadReview($target);
            } catch (\Throwable) {
            }
        }

        if ($target !== null && $author !== null) {
            try {
                UserNotifier::send($target, new \App\Notifications\DatingReviewedNotification($author, (int) $target->id, $review));
            } catch (\Throwable) {
            }

            try {
                $authorName = trim((string) ($author->name ?? ''));

                TelegramNotifier::eventPing(
                    $target,
                    'reviews',
                    '⭐ 💘 <b>ULove</b> • <b>'.e($authorName !== '' ? $authorName : 'Собеседник').'</b> оценил(а) тебя на '.(int) $review->rating.' из 5',
                    '/profile',
                    'Смотреть отзыв',
                    'dating-review:'.(int) $review->id,
                    null
                );
            } catch (\Throwable) {
            }
        }

        return $review->refresh();
    }

    /**
     * Отклонить отзыв из очереди модерации.
     *
     * Отклонение ранее одобренного возвращает траст-скор цели
     * (штраф за 1–2 звезды снимаем обратно). Автор получает
     * уведомление о решении.
     *
     * @param DatingReview $review отзыв
     * @param User $moderator кто отклонил
     * @return DatingReview
     */
    public function reject(DatingReview $review, User $moderator): DatingReview
    {
        $wasApproved = $review->isApproved();

        $review->forceFill([
            'status' => DatingReview::STATUS_REJECTED,
            'moderator_id' => $moderator->id,
            'moderated_at' => now(),
        ])->save();

        if ($wasApproved) {
            $target = $review->target;

            if ($target !== null && (int) $review->rating <= 2) {
                try {
                    TrustScoreService::adjust($target, 1);
                } catch (\Throwable) {
                }
            }
        }

        try {
            UserNotifier::send($review->author, new \App\Notifications\ReviewModeratedNotification($review));
        } catch (\Throwable) {
        }

        return $review->refresh();
    }

    /**
     * Очередь модерации для админки: пачка отзывов + число pending.
     *
     * Автор и получатель подтягиваются мини-профилями (имя, аватар
     * для карточки решения). Статусы: pending|approved|rejected|all.
     *
     * @param User|null $viewer смотрящий (null — не проверяем: у вызова свой abort)
     * @param string $status фильтр очереди
     * @param int $perPage размер страницы
     * @return array{page:LengthAwarePaginator, pending_count:int}
     */
    public function moderationQueue(?string $status = 'pending', int $perPage = 15): array
    {
        $statuses = [
            DatingReview::STATUS_PENDING,
            DatingReview::STATUS_APPROVED,
            DatingReview::STATUS_REJECTED,
        ];

        $chosen = in_array($status, $statuses, true) ? $status : null;

        $query = DatingReview::query()->with(['author:id,name,avatar_path,profile_slug', 'target:id,name,avatar_path,profile_slug']);

        if ($chosen !== null) {
            $query->where('status', $chosen);
        }

        $page = $query->latest('id')->paginate($perPage);

        $pendingCount = DatingReview::where('status', DatingReview::STATUS_PENDING)->count();

        return ['page' => $page, 'pending_count' => $pendingCount];
    }

    /**
     * Удалить свой отзыв. Обычным пользователям запрещено:
     * иначе заморозку звёзд обходили бы удалением и новой оценкой.
     *
     * @param User $author владелец отзыва
     * @param User $target о ком был отзыв
     * @return bool true когда было что удалять
     */
    public function deleteOwn(User $author, User $target): bool
    {
        abort_if(! $author->isAdmin(), 403, 'Удалить отзыв нельзя — звёзды ставятся раз и навсегда');

        return (bool) DatingReview::where('author_id', $author->id)
            ->where('target_id', $target->id)
            ->delete();
    }

    /**
     * Кто оценил владельца: сводка, раскладка по звёздам, постраничный список.
     *
     * Вызывается только для себя (target = me): чужие списки смотрятся
     * обычным index. Автор подтягивается мини-профилем для ссылки.
     *
     * @param User $target владелец рейтинга (всегда сам смотрящий)
     * @param int $perPage размер страницы
     * @return array{summary:array,distribution:array<int,int>,page:LengthAwarePaginator}
     */
    public function ratersFor(User $target, int $perPage = 10): array
    {
        $rows = DatingReview::where('target_id', $target->id)
            ->where('status', DatingReview::STATUS_APPROVED)
            ->selectRaw('rating, COUNT(*) as count')
            ->groupBy('rating')
            ->pluck('count', 'rating')
            ->all();

        $distribution = [];

        for ($stars = 1; $stars <= 5; $stars++) {
            $distribution[$stars] = (int) ($rows[$stars] ?? 0);
        }

        $page = DatingReview::where('target_id', $target->id)
            ->where('status', DatingReview::STATUS_APPROVED)
            ->with(['author:id,name,avatar_path,profile_slug'])
            ->latest('id')
            ->paginate($perPage);

        return [
            'summary' => $this->summary($target, $target),
            'distribution' => $distribution,
            'page' => $page,
        ];
    }

    /**
     * Сериализация одного отзыва для фронта.
     *
     * @param DatingReview $review отзыв с подгруженным автором
     * @return array<string,mixed>
     */
    public function serialize(DatingReview $review): array
    {
        $author = $review->relationLoaded('author') ? $review->author : null;

        return [
            'id' => (int) $review->id,
            'rating' => (int) $review->rating,
            'body' => $review->body,
            'status' => (string) $review->status,
            'moderation' => ContentModeration::flagsFor($review->body),
            'created_at' => $review->created_at?->toISOString(),
            'author' => $author ? [
                'id' => (int) $author->id,
                'name' => $author->name,
                'avatar_url' => $author->avatar_url ?? null,
                'profile_slug' => $author->profile_slug ?? null,
            ] : null,
        ];
    }

    /**
     * Сериализация отзыва для очереди модерации в админке.
     *
     * К карточке решения нужны автор, получатель, статус, кто и
     * когда принял предыдущее решение.
     *
     * @param DatingReview $review отзыв с подгруженным автором и target
     * @return array<string,mixed>
     */
    public function serializeForModeration(DatingReview $review): array
    {
        $author = $review->relationLoaded('author') ? $review->author : null;
        $target = $review->relationLoaded('target') ? $review->target : null;

        return [
            'id' => (int) $review->id,
            'rating' => (int) $review->rating,
            'body' => $review->body,
            'status' => (string) $review->status,
            'created_at' => $review->created_at?->toISOString(),
            'moderated_at' => $review->moderated_at?->toISOString(),
            'author' => $author ? [
                'id' => (int) $author->id,
                'name' => $author->name,
                'avatar_url' => $author->avatar_url ?? null,
                'profile_slug' => $author->profile_slug ?? null,
            ] : null,
            'target' => $target ? [
                'id' => (int) $target->id,
                'name' => $target->name,
                'avatar_url' => $target->avatar_url ?? null,
                'profile_slug' => $target->profile_slug ?? null,
            ] : null,
        ];
    }
}
