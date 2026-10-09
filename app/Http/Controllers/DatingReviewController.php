<?php

namespace App\Http\Controllers;

use App\Models\DatingReview;
use App\Models\User;
use App\Services\DatingReviewService;
use App\Services\DatingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Отзывы о пользователях знакомств: звёзды и короткие тексты.
 *
 * Читать могут все прошедшие age-gate свайпов; писать — только
 * взаимодействовавшие (мэтч или direct-диалог). Скрытый PRO-рейтинг
 * видят только владелец и админы.
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
     * Создать или обновить свой отзыв.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'body' => ['nullable', 'string', 'max:'.DatingReviewService::BODY_LIMIT],
        ]);

        $me = $request->user();
        $target = User::findOrFail((int) $data['user_id']);

        app(DatingService::class)->assertAdult($me);

        $review = $this->reviews->upsert($me, $target, (int) $data['rating'], $data['body'] ?? null);

        if ($review->wasRecentlyCreated) {
            try {
                \App\Services\UserNotifier::send($target, new \App\Notifications\DatingReviewedNotification($me, (int) $target->id, $review));
            } catch (\Throwable) {
            }

            try {
                $authorName = trim((string) ($me->name ?? ''));
                \App\Services\TelegramNotifier::eventPing(
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

        return response()->json([
            'review' => $this->reviews->serialize($review->load('author')),
            'summary' => $this->reviews->summary($target, $me),
        ], 201);
    }

    /**
     * Удалить свой отзыв.
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
}
