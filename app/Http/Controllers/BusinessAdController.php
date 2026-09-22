<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\BusinessAd;
use App\Services\ContentModeration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Реклама проверенного бизнеса: новости и акции компании.
 *
 * Читать могут все (витрина Business/Show), писать — только владелец
 * верифицированного бизнеса или админ. Анти-спам: максимум WEEKLY_LIMIT
 * штук за скользящие 7 дней на бизнес (429 с понятным текстом).
 */
class BusinessAdController extends Controller
{
    /**
     * Недельный лимит рекламы на один бизнес (скользящие 7 дней).
     */
    public const WEEKLY_LIMIT = 3;

    /**
     * Реклама компании для публичной витрины (новые сверху).
     *
     * @param Business $business компания
     * @return JsonResponse список рекламы
     */
    public function index(Business $business): JsonResponse
    {
        abort_unless($business->is_active, 404);

        $ads = BusinessAd::where('business_id', $business->id)
            ->orderByDesc('created_at')
            ->limit(30)
            ->get();

        return response()->json($ads->map(fn (BusinessAd $ad) => $ad->toPublicArray())->values());
    }

    /**
     * Сколько слотов недели осталось у бизнеса.
     *
     * @param Request $request запрос владельца
     * @return JsonResponse used/limit/left
     */
    public function quota(Request $request): JsonResponse
    {
        $business = $this->ownedBusiness($request);

        $used = BusinessAd::usedThisWeek($business->id);

        return response()->json([
            'used' => $used,
            'limit' => self::WEEKLY_LIMIT,
            'left' => max(0, self::WEEKLY_LIMIT - $used),
        ]);
    }

    /**
     * Опубликовать рекламу (только проверенный бизнес).
     *
     * @param Request $request запрос владельца
     * @param Business $business компания
     * @return JsonResponse созданная реклама (201)
     */
    public function store(Request $request, Business $business): JsonResponse
    {
        $user = $request->user();

        abort_unless($business->user_id === $user->id || $user->isAdmin(), 403, 'Реклама — только своей компании');
        abort_unless($business->isVerified() || $user->isAdmin(), 403, 'Реклама доступна после проверки компании по УНП');

        $this->assertWeeklyLimit($business);

        $data = $request->validate([
            'title' => 'required|string|max:100',
            'body' => 'required|string|max:1000',
        ]);

        $title = trim($data['title']);
        $body = trim($data['body']);

        abort_if($title === '' || $body === '', 422, 'Заполните заголовок и текст');

        ContentModeration::assertClean($title, $body);

        $this->assertWeeklyLimit($business->fresh());

        $ad = BusinessAd::create([
            'business_id' => $business->id,
            'user_id' => $user->id,
            'title' => mb_substr($title, 0, 100),
            'body' => mb_substr($body, 0, 1000),
        ]);

        return response()->json($ad->toPublicArray(), 201);
    }

    /**
     * Править рекламу (владелец или админ, без смены недели).
     *
     * @param Request $request запрос
     * @param BusinessAd $ad реклама
     * @return JsonResponse обновлённая реклама
     */
    public function update(Request $request, BusinessAd $ad): JsonResponse
    {
        $user = $request->user();

        abort_unless($ad->user_id === $user->id || $user->isAdmin(), 403);

        $data = $request->validate([
            'title' => 'sometimes|required|string|max:100',
            'body' => 'sometimes|required|string|max:1000',
        ]);

        $patch = [];

        if (array_key_exists('title', $data)) {
            $title = trim($data['title']);
            abort_if($title === '', 422, 'Заполните заголовок');
            $patch['title'] = mb_substr($title, 0, 100);
        }

        if (array_key_exists('body', $data)) {
            $body = trim($data['body']);
            abort_if($body === '', 422, 'Заполните текст');
            $patch['body'] = mb_substr($body, 0, 1000);
        }

        ContentModeration::assertClean($patch['title'] ?? $ad->title, $patch['body'] ?? $ad->body);

        $ad->update($patch);

        return response()->json($ad->fresh()->toPublicArray());
    }

    /**
     * Удалить рекламу (владелец или админ, слот недели не возвращается).
     *
     * @param Request $request запрос
     * @param BusinessAd $ad реклама
     * @return JsonResponse ok
     */
    public function destroy(Request $request, BusinessAd $ad): JsonResponse
    {
        $user = $request->user();

        abort_unless($ad->user_id === $user->id || $user->isAdmin(), 403);

        $ad->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Бизнес текущего пользователя (для квоты).
     *
     * @param Request $request запрос владельца
     * @return Business
     */
    private function ownedBusiness(Request $request): Business
    {
        $business = Business::where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->first();

        abort_if($business === null, 404, 'Бизнес-профиль не найден');

        return $business;
    }

    /**
     * Проверить недельный лимит (429 когда 3 штуки уже выпущены).
     *
     * @param Business $business компания
     * @return void
     */
    private function assertWeeklyLimit(Business $business): void
    {
        $used = BusinessAd::usedThisWeek($business->id);

        abort_if(
            $used >= self::WEEKLY_LIMIT,
            429,
            'Без спама: максимум '.self::WEEKLY_LIMIT.' рекламы в неделю. Следующий слот освободится через 7 дней после самой старой.'
        );
    }
}
