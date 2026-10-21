<?php

namespace App\Http\Controllers;

use App\Models\DatingReview;
use App\Models\User;
use App\Services\DatingReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Очередь модерации отзывов ULove (админка, раздел «Модерация»).
 *
 * Доступен модераторам и админам (админ — тоже модератор).
 * Каждый отзыв до публикации лежит со статусом pending: персонал
 * одабривает (тогда отзыв летит в профиль и карточки свайпов,
 * уведомления уходят получателю) или отклоняет (автору уходит
 * соответствующее уведомление).
 */
class AdminDatingReviewController extends Controller
{
    public function __construct(private readonly DatingReviewService $reviews)
    {
    }

    /**
     * Очередь отзывов по статусу + число тех, что ждут решения.
     *
     * @param Request $request фильтр статуса и размер страницы
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->canModerate(), 403);

        $data = $request->validate([
            'status' => ['sometimes', 'string', 'in:pending,approved,rejected,all'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:30'],
        ]);

        $status = (string) ($data['status'] ?? DatingReview::STATUS_PENDING);
        $perPage = (int) ($data['per_page'] ?? 15);

        $bundle = $this->reviews->moderationQueue($status, $perPage);
        $page = $bundle['page'];

        $items = collect($page->items())
            ->map(fn (DatingReview $review) => $this->reviews->serializeForModeration($review))
            ->all();

        return response()->json([
            'reviews' => $items,
            'pending_count' => (int) $bundle['pending_count'],
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'has_more' => $page->hasMorePages(),
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * Вердикт по отзыву: одобрить или отклонить.
     *
     * @param Request $request новый статус
     * @param DatingReview $review отзыв из очереди
     * @return JsonResponse
     */
    public function resolve(Request $request, DatingReview $review): JsonResponse
    {
        abort_unless($request->user()->canModerate(), 403);

        $data = $request->validate([
            'status' => ['required', 'string', 'in:approved,rejected'],
        ]);

        /** @var User $moderator */
        $moderator = $request->user();

        if ($data['status'] === DatingReview::STATUS_APPROVED) {
            $review = $review->load(['author', 'target']);
            $requestedReview = $this->reviews->approve($review, $moderator);
        } else {
            $requestedReview = $this->reviews->reject($review, $moderator);
        }

        return response()->json([
            'review' => $this->reviews->serializeForModeration($requestedReview->loadMissing(['author', 'target'])),
        ]);
    }
}
