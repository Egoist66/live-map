<?php

namespace App\Services;

use App\Mail\ReviewDeletedMail;
use App\Models\Conversation;
use App\Models\DatingReview;
use App\Models\User;
use App\Models\UserBlock;
use App\Notifications\ReviewDeletedNotification;
use App\Notifications\ReviewPendingNotification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Отзывы о пользователях знакомств: кто может, сводка, список, модерация.
 *
 * Оставить отзыв может только взаимодействовавший по-настоящему:
 * прямой диалог, где было не меньше MESSAGES_MIN_TOTAL сообщений
 * (MESSAGES_MIN_PER_SIDE с каждой стороны). Мэтч без переписки /
 * пара слов в чате — не взаимодействие: месть-минуска и флуд
 * отпадают на гейте. Спам-поведение (дубли, КАПС, темп) режет
 * FloodGuard с контекстом 'review' в контроллере.
 *
 * Один автор — один отзыв. Отзыв обязателен с текстом от BODY_MIN
 * символов. Звёзды ставятся раз и навсегда: повторная отправка
 * меняет только текст, новую оценку примет только персонал.
 * Удаление своего отзыва обычным пользователям запрещено — иначе
 * заморозку звёзд обходили бы через удалить/поставить заново.
 *
 * Модерация дифференцированная:
 * - персонал (canModerate) публикуется сразу;
 * - 4–5★ от трастовых авторов (trust_score >= AUTO_APPROVE_MIN_TRUST)
 *   — авто-approve сразу после синхронной ContentModeration;
 * - всё остальное (прежде всего 1–2★) — ручная очередь pending:
 *   админ/модератор одобряет в админке, персонал получает realtime
 *   уведомление review.created (сокет + polling-зеркало).
 * Скрытие рейтинга — привилегия платных тарифов (dating_hide_rating):
 * скрыт — сводка и список не отдаются никому, кроме владельца и
 * персонала, а новый отзыв таким людям поставить нельзя.
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
     * Минимум сообщений в общем диалоге, чтобы можно было оставить
     * отзыв: месть-минуска сразу после короткой переписки отпадает.
     */
    public const MESSAGES_MIN_TOTAL = 10;

    /**
     * Минимум сообщений с каждой из сторон диалога: односторонний
     * спам не засчитывается, общение должно быть двусторонним.
     */
    public const MESSAGES_MIN_PER_SIDE = 3;

    /**
     * Авто-одобрение: отзывы 4–5★ от трастовых авторов публикуются
     * без ручной очереди (ручная очередь остаётся только на низкие).
     */
    public const AUTO_APPROVE_MIN_RATING = 4;

    /**
     * Порог траст-скора автора для авто-одобрения (1–10, зона
     * «Хорошо» и выше — TrustScoreService::scoreOf).
     */
    public const AUTO_APPROVE_MIN_TRUST = 7;

    /**
     * Может ли автор оценить человека.
     *
     * Нельзя себя, заблокированных (в любую сторону), скрывших
     * рейтинг и тех, с кем не было осмысленного общения: прямой
     * диалог, где всего не меньше MESSAGES_MIN_TOTAL сообщений и
     * хотя бы MESSAGES_MIN_PER_SIDE с каждой стороны. Мэтч без
     * переписки — не взаимодействие (голые минуски со свежего
     * мэтча не публикуются). Админам и модераторам можно всегда:
     * модерация отзывов без возможности посмотреть.
     *
     * @param User $author кто оценивает
     * @param User $target кого оценивают
     * @return bool
     */
    public function canReview(User $author, User $target): bool
    {
        return $this->reviewBlockReason($author, $target) === null;
    }

    /**
     * Почему отзыв нельзя оставить: текст-подсказка или null.
     *
     * Канонический порядок запретов: самооценка → скрытый рейтинг →
     * персонал-байпас → блокировки → осмысленное общение. Стафф
     * проверяется до блокировок: даже заблокированному модератору
     * нужно писать отзыв-вывод по жалобе.
     *
     * @param User $author кто оценивает
     * @param User $target кого оценивают
     * @return string|null причина запрета либо null когда можно
     */
    public function reviewBlockReason(User $author, User $target): ?string
    {
        if ((int) $author->id === (int) $target->id) {
            return 'Себя оценить нельзя';
        }

        if ((bool) ($target->dating_hide_rating ?? false) && ! $author->canModerate()) {
            return null;
        }

        if ($author->canModerate()) {
            return null;
        }

        $blocked = UserBlock::where(function ($query) use ($author, $target) {
            $query->where(function ($inner) use ($author, $target) {
                $inner->where('blocker_id', $author->id)->where('blocked_id', $target->id);
            })->orWhere(function ($inner) use ($author, $target) {
                $inner->where('blocker_id', $target->id)->where('blocked_id', $author->id);
            });
        })->exists();

        if ($blocked) {
            return null;
        }

        $dialog = Conversation::findDirect((int) $author->id, (int) $target->id);

        if ($dialog === null || ! $this->hasMeaningfulExchange($dialog)) {
            return 'Отзыв появится после общения: не меньше '
                .self::MESSAGES_MIN_TOTAL.' сообщений в переписке '
                .'('.self::MESSAGES_MIN_PER_SIDE.' с каждой стороны)';
        }

        return null;
    }

    /**
     * Был ли в диалоге настоящий двусторонний обмен сообщениями.
     *
     * Считаем по таблице messages: общий итог и вклад каждой стороны.
     * Голый мэтч и «диалог» из пары строк увода от оценки не спасают —
     * отзыв становится возможен только после реальной переписки.
     *
     * @param Conversation $dialog direct-диалог пары
     * @return bool true когда обмен достаточен для оценки
     */
    private function hasMeaningfulExchange(Conversation $dialog): bool
    {
        $countsBySender = $dialog->messages()
            ->selectRaw('sender_id, COUNT(*) as messages_count')
            ->groupBy('sender_id')
            ->pluck('messages_count', 'sender_id');

        $total = (int) $countsBySender->sum();
        $activeSenders = $countsBySender
            ->filter(fn ($count): bool => (int) $count > 0)
            ->count();

        $minSideCount = $countsBySender->count() >= 2
            ? (int) $countsBySender->min()
            : 0;

        $enoughTotal = $total >= self::MESSAGES_MIN_TOTAL;
        $bothWrote = $activeSenders >= 2;
        $sidesBalanced = $minSideCount >= self::MESSAGES_MIN_PER_SIDE;

        return $enoughTotal && $bothWrote && $sidesBalanced;
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

        if ($hidden && ! $isSelf && ! ($viewer?->canModerate() ?? false)) {
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
        $viewerCanModerate = $viewer !== null && $viewer->canModerate();

        $hiddenIds = [];

        if (! $viewerCanModerate) {
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
     * текст — чужую оценку поверх примет лишь персонал. Текст
     * обязателен (минимум BODY_MIN символов) — голые оценки не
     * публикуем. Публикация по стратам: персонал — сразу
     * approved; позитивные 4–5★ от трастовых (trust >= 7) —
     * авто-approve с теми же последействиями, что ручное одобрение
     * (уведомление, тг-пинг, штраф траста цели за низкие). Всё
     * прочее уходит в pending и летит персоналу realtime-событием
     * review.created для очереди в админке.
     *
     * @param User $author кто оценивает
     * @param User $target кого оценивают
     * @param int|null $rating звёзды 1–5 (null — только текст)
     * @param string|null $body текст
     * @return DatingReview
     */
    public function upsert(User $author, User $target, ?int $rating, ?string $body): DatingReview
    {
        $blockReason = $this->reviewBlockReason($author, $target);

        abort_if($blockReason !== null, 422, $blockReason ?? 'Отзыв можно оставить только после общения');

        $existing = DatingReview::where('author_id', $author->id)
            ->where('target_id', $target->id)
            ->first();

        $isStaff = $author->canModerate();

        if ($existing !== null && ! $isStaff) {
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

        $trustedEnough = TrustScoreService::scoreOf($author) >= self::AUTO_APPROVE_MIN_TRUST;
        $autoApprove = ! $isStaff && $rating >= self::AUTO_APPROVE_MIN_RATING && $trustedEnough;

        $review = DatingReview::updateOrCreate(
            ['author_id' => $author->id, 'target_id' => $target->id],
            [
                'rating' => $rating,
                'body' => $clean,
                'status' => ($isStaff || $autoApprove) ? DatingReview::STATUS_APPROVED : DatingReview::STATUS_PENDING,
                'moderator_id' => $isStaff ? $author->id : null,
                'moderated_at' => ($isStaff || $autoApprove) ? now() : null,
            ]
        );

        try {
            \App\Jobs\ModeratePublicContentJob::dispatch('dating_review', (int) $review->id, (int) $author->id, (string) $clean);
        } catch (\Throwable) {
        }

        if ($isStaff) {
            $review->load(['author', 'target']);

            try {
                $this->approve($review, $author);
            } catch (\Throwable) {
            }

            return $review;
        }

        if ($autoApprove) {
            $review->load(['author', 'target']);

            try {
                $this->afterFirstApproval($review->refresh());
            } catch (\Throwable) {
            }

            return $review;
        }

        try {
            $this->notifyStaffPending($review->load(['author', 'target']));
        } catch (\Throwable) {
        }

        return $review;
    }

    /**
     * Довести до персонала new pending-отзыв: realtime-событие
     * review.created по каналу user.{id} каждого модератора и
     * админа + inbox-строка для поллера. Идемпотентно по
     * dedupeKey ReviewPendingNotification (id + updated_at).
     *
     * @param DatingReview $review отзыв в статусе pending
     * @return void
     */
    private function notifyStaffPending(DatingReview $review): void
    {
        $staff = User::query()
            ->where(function ($query) {
                $query->where('is_admin', true)->orWhereIn('role', ['admin', 'moderator']);
            })
            ->get(['id', 'role', 'is_admin']);

        foreach ($staff as $moderator) {
            try {
                UserNotifier::send($moderator, new ReviewPendingNotification($review));
            } catch (\Throwable) {
                // Ошибка доставки одному из персонала не роняет отправку.
            }
        }
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

        return $this->afterFirstApproval($review->refresh());
    }

    /**
     * Последействия первого одобрения (ручного или авто).
     *
     * Штраф траста цели за 1–2★, уведомление цели с realtime
     * (dating.reviewed → сокет + polling-зеркало) и тг-пинг.
     * Все шаги в try/catch: сайд-эффект не валит публикацию.
     *
     * @param DatingReview $review отзыв со свежим статусом approved
     * @return DatingReview тот же отзыв (для чейнинга)
     */
    private function afterFirstApproval(DatingReview $review): DatingReview
    {
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

        return $review;
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

        if ($chosen === DatingReview::STATUS_PENDING) {
            // Очередь с приоритетом: худшие оценки разбираем первыми —
            // именно там риск несанкционированной минуски/мести.
            $query->orderBy('rating')->orderByDesc('id');
        } else {
            $query->latest('id');
        }

        $page = $query->paginate($perPage);

        $pendingCount = DatingReview::where('status', DatingReview::STATUS_PENDING)->count();

        return ['page' => $page, 'pending_count' => $pendingCount];
    }

    /**
     * Удалить свой отзыв. Обычным пользователям запрещено:
     * иначе заморозку звёзд обходили бы удалением и новой оценкой.
     * Админы и модераторы могут всегда.
     *
     * @param User $author владелец отзыва
     * @param User $target о ком был отзыв
     * @return bool true когда было что удалять
     */
    public function deleteOwn(User $author, User $target): bool
    {
        abort_if(! $author->canModerate(), 403, 'Удалить отзыв нельзя — звёзды ставятся раз и навсегда');

        return (bool) DatingReview::where('author_id', $author->id)
            ->where('target_id', $target->id)
            ->delete();
    }

    /**
     * Удалить чужой отзыв: только персонал (админы и модераторы) и
     * всегда с объяснением для автора.
     *
     * Чистим безвозвратно (мягких удалений у отзывов нет). Если удалили
     * опубликованный низкий отзыв — возвращаем траст-скор получателю
     * (зеркально reject: штраф за 1–2★ снимается). Автору уходит
     * уведомление review.deleted (сокет + polling-зеркало) с текстом
     * объяснения и письмо на подтверждённую почту.
     *
     * @param DatingReview $review чужой отзыв
     * @param User $moderator кто удаляет (canModerate проверен в контроллере)
     * @param string $reason объяснение для автора (обязательно, 5–500 символов)
     * @return bool true когда было что удалять
     */
    public function deleteByModerator(DatingReview $review, User $moderator, string $reason): bool
    {
        $review->loadMissing(['author', 'target']);

        $author = $review->author;
        $target = $review->target;
        $reviewData = $review->toNotifyArray();
        $wasApproved = $review->isApproved();

        $deleted = (bool) $review->delete();

        if (! $deleted) {
            return false;
        }

        if ($wasApproved && $target !== null && (int) $review->rating <= 2) {
            try {
                TrustScoreService::adjust($target, 1);
            } catch (\Throwable) {
            }
        }

        if ($author !== null) {
            try {
                UserNotifier::send($author, new ReviewDeletedNotification($review, $reason));
            } catch (\Throwable) {
            }

            $this->emailDeletedReview($author, $reviewData, $reason);
        }

        return true;
    }

    /**
     * Письмо автору об удалении его отзыва: с объяснением и правилами.
     *
     * Системное письмо о модерации — шлём на любую валидную
     * подтверждённую почту, минуя канальные тумблеры дейтинг-писем:
     * решение о его контенте человек должен получить в любом случае.
     *
     * @param User $author автор удалённого отзыва
     * @param array<string, mixed> $reviewData пейлоад отзыва (toNotifyArray)
     * @param string $reason объяснение от модератора
     * @return void
     */
    private function emailDeletedReview(User $author, array $reviewData, string $reason): void
    {
        $email = trim((string) ($author->email ?? ''));

        $emailValid = $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;

        if (! $emailValid || ! $author->hasVerifiedEmail()) {
            return;
        }

        try {
            Mail::to($email)->queue(new ReviewDeletedMail(
                $author,
                (int) $reviewData['id'],
                (int) $reviewData['rating'],
                is_string($reviewData['excerpt'] ?? null) ? $reviewData['excerpt'] : null,
                $reason
            ));
        } catch (\Throwable $error) {
            Log::warning('review deleted email failed: '.$error->getMessage());
        }
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
