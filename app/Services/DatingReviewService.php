<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\DatingMatch;
use App\Models\DatingReview;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Отзывы о пользователях знакомств: кто может, сводка, список.
 *
 * Оставить отзыв может только взаимодействовавший: мэтч или
 * direct-диалог (писал сам, писали ему, уже общаются). Один автор —
 * один отзыв. Звёзды ставятся раз и навсегда: повторная отправка
 * меняет только текст, новую оценку примет только админ.
 * Удаление своего отзыва обычным пользователям запрещено —
 * иначе заморозку звёзд обходили бы через удалить/поставить заново.
 * Скрытие рейтинга — привилегия PRO и выше (dating_hide_rating):
 * скрыт — сводка и список не отдаются никому, кроме владельца.
 */
class DatingReviewService
{
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
            ->with(['author:id,name,avatar_path,profile_slug'])
            ->latest('id')
            ->paginate($perPage);
    }

    /**
     * Создать отзыв или поправить текст своего.
     *
     * Звёзды заморожены: у кого отзыв уже есть, тот меняет только
     * текст — чужую оценку поверх примут лишь от админа. Без оценки
     * и без старого отзыва — 422. Правка только текста (rating null)
     * разрешена всем, у кого есть отзыв.
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

        $clean = $body !== null ? trim((string) $body) : null;

        if ($clean === '') {
            $clean = null;
        }

        if ($clean !== null && mb_strlen($clean) > self::BODY_LIMIT) {
            $clean = mb_substr($clean, 0, self::BODY_LIMIT);
        }

        return DatingReview::updateOrCreate(
            ['author_id' => $author->id, 'target_id' => $target->id],
            ['rating' => $rating, 'body' => $clean]
        );
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
            'created_at' => $review->created_at?->toISOString(),
            'author' => $author ? [
                'id' => (int) $author->id,
                'name' => $author->name,
                'avatar_url' => $author->avatar_url ?? null,
                'profile_slug' => $author->profile_slug ?? null,
            ] : null,
        ];
    }
}
