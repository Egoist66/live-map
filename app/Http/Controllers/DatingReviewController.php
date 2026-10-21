<?php

namespace App\Http\Controllers;

use App\Models\DatingReview;
use App\Models\User;
use App\Services\DatingReviewService;
use App\Services\DatingService;
use App\Services\FloodGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Отзывы о пользователях знакомств: звёзды и короткие тексты.
 *
 * Читать могут все прошедшие age-gate свайпов; писать — только тем,
 * с кем была настоящая переписка (гейт в DatingReviewService).
 * Флуд и дубли текста режет FloodGuard с контекстом 'review'.
 * Скрытый платный рейтинг (dating_hide_rating) видят только
 * владелец и персонал, а новый отзыв таким людям не оставить.
 */
class DatingReviewController extends Controller
{
    public function __construct(private readonly DatingReviewService $reviews)
    {
    }

    /**
     * Сводка + список отзывов + мой отзыв + право оценить.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:20'],
        ]);

        $me = $request->user();
        $target = User::findOrFail((int) $data['user_id']);

        $mine = DatingReview::where('author_id', $me->id)
            ->where('target_id', $target->id)
            ->first();

        $page = $this->reviews->listFor($target, $me, (int) ($data['per_page'] ?? 10));
        $items = collect($page->items())->map(fn ($row) => $this->reviews->serialize($row))->all();

        return response()->json([
            'summary' => $this->reviews->summary($target, $me),
            'can_review' => $this->reviews->canReview($me, $target),
            'can_review_reason' => $this->reviews->reviewBlockReason($me, $target),
            'my_review' => $mine ? $this->reviews->serialize($mine->loadMissing('author')) : null,
            'reviews' => $items,
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'has_more' => $page->hasMorePages(),
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * Создать отзыв или поправить текст своего.
     *
     * Отзыв всегда с текстом: минимум 50 символов — голые оценки
     * не публикуются. Перед сохранением FloodGuard.Context 'review'
     * отбивает флуд: дубли текста, темп, КАПС и спам ссылками
     * (персонал проходит насквозь). Стратификация модерации —
     * в DatingReviewService::upsert (персонал/трастовые сразу,
     * низкие оценки — ручная очередь с realtime-пингом персонала).
     * Уведомления и штрафы траста срабатывают на одобрении.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'body' => ['required', 'string', 'min:'.DatingReviewService::BODY_MIN, 'max:'.DatingReviewService::BODY_LIMIT],
        ]);

        $me = $request->user();
        $target = User::findOrFail((int) $data['user_id']);

        app(DatingService::class)->assertAdult($me);

        $floodGuard = app(FloodGuard::class);

        $floodGuard->assertNotFlooding($me, $data['body'], 'review');

        $review = $this->reviews->upsert($me, $target, isset($data['rating']) ? (int) $data['rating'] : null, $data['body']);

        $floodGuard->remember($me, $data['body'], 'review');

        return response()->json([
            'review' => $this->reviews->serialize($review->load('author')),
            'summary' => $this->reviews->summary($target, $me),
        ], 201);
    }

    /**
     * Кто меня оценил: сводка, раскладка по звёздам и список авторов.
     *
     * Смотрят только себя: список чужих и так виден в index. Полные
     * авторы — привилегия Premium (админы и модераторы проходят через
     * isPremium): остальным отдаём locked + обезличенную раскладку
     * для красивого апсейла в модалке.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function raters(Request $request): JsonResponse
    {
        $data = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:20'],
        ]);

        $me = $request->user();
        $bundle = $this->reviews->ratersFor($me, (int) ($data['per_page'] ?? 10));

        /** @var \Illuminate\Contracts\Pagination\LengthAwarePaginator $page */
        $page = $bundle['page'];

        if (! $me->isPremium()) {
            return response()->json([
                'locked' => true,
                'summary' => $bundle['summary'],
                'distribution' => $bundle['distribution'],
                'raters' => [],
                'meta' => [
                    'current_page' => $page->currentPage(),
                    'last_page' => $page->lastPage(),
                    'has_more' => $page->hasMorePages(),
                    'total' => $page->total(),
                ],
            ]);
        }

        $items = collect($page->items())->map(fn ($row) => $this->reviews->serialize($row))->all();

        return response()->json([
            'locked' => false,
            'summary' => $bundle['summary'],
            'distribution' => $bundle['distribution'],
            'raters' => $items,
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'has_more' => $page->hasMorePages(),
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * Удалить свой отзыв. Персоналу (админы и модераторы): иначе
     * заморозку звёзд обходили бы удалением и новой оценкой.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $me = $request->user();
        $target = User::findOrFail((int) $data['user_id']);

        $deleted = $this->reviews->deleteOwn($me, $target);

        return response()->json(['ok' => true, 'deleted' => $deleted]);
    }

    /**
     * Удалить ЧУЖОЙ отзыв по id. Только персонал (админы и модераторы).
     *
     * Объяснение обязательно: автору уходит уведомление review.deleted
     * (сокет + polling-зеркало + колокольчик) с текстом причины и
     * письмо на подтверждённую почту. Пустое «удалено» не допустимо —
     * оно воспринимается как произвол.
     *
     * @param \Illuminate\Http\Request $request запрос с полем reason
     * @param \App\Models\DatingReview $review удаляемый отзыв (route-binding)
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroyById(Request $request, DatingReview $review): JsonResponse
    {
        $me = $request->user();

        abort_unless($me->canModerate(), 403, 'Удалять чужие отзывы может только персонал');

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        $deleted = $this->reviews->deleteByModerator($review, $me, trim((string) $data['reason']));

        if (! $deleted) {
            return response()->json(['message' => 'Отзыв уже удалён'], 404);
        }

        return response()->json(['ok' => true]);
    }
}
