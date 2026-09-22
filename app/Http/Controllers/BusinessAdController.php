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
     * Недельный лимит размещений рекламы в районах (скользящие 7 дней).
     */
    public const DISTRICT_WEEKLY_LIMIT = 3;

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

        $this->publishCompanyPost($ad->fresh(), $business->fresh());

        return response()->json($ad->toPublicArray(), 201);
    }

    /**
     * Выпустить рекламу новостью компании в UFlow.
     *
     * Пост идёт от бренда (business_id) — в ленте всегда в топе
     * и с плашкой «Новость компании». Хэштеги из текста подхватываются
     * как у обычных постов, подписчики владельца уведомляются.
     *
     * @param BusinessAd $ad созданная реклама
     * @param Business $business компания-владелец
     * @return void
     */
    private function publishCompanyPost(BusinessAd $ad, Business $business): void
    {
        try {
            $post = \App\Models\FlowPost::create([
                'user_id' => $ad->user_id,
                'business_id' => $business->id,
                'business_ad_id' => $ad->id,
                'title' => $ad->title,
                'body' => $ad->body,
                'is_anonymous' => false,
            ]);

            \App\Services\FlowHashtags::sync($post);
            \App\Services\FlowPostNotifier::postCreated($post->refresh());
        } catch (\Throwable $e) {
            \Log::warning('business ad flow post failed', ['ad_id' => $ad->id, 'error' => $e->getMessage()]);
        }
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

        $this->syncCompanyPost($ad->fresh());

        $this->syncDistrictCopies($ad->fresh());

        return response()->json($ad->fresh()->toPublicArray());
    }

    /**
     * Подтянуть правку рекламы в пост UFlow.
     *
     * @param BusinessAd $ad обновлённая реклама
     * @return void
     */
    private function syncCompanyPost(BusinessAd $ad): void
    {
        try {
            $post = \App\Models\FlowPost::where('business_ad_id', $ad->id)->first();

            if (! $post) {
                return;
            }

            $post->forceFill([
                'title' => $ad->title,
                'body' => $ad->body,
            ])->save();

            \App\Services\FlowHashtags::sync($post->refresh());
        } catch (\Throwable $e) {
            \Log::warning('business ad flow sync failed', ['ad_id' => $ad->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Подтянуть правку рекламы в её копии в районах.
     *
     * @param BusinessAd $ad обновлённая реклама
     * @return void
     */
    private function syncDistrictCopies(BusinessAd $ad): void
    {
        try {
            \App\Models\DistrictPost::where('business_ad_id', $ad->id)
                ->update([
                    'title' => $ad->title,
                    'body' => $ad->body,
                ]);
        } catch (\Throwable $e) {
            \Log::warning('business ad district sync failed', ['ad_id' => $ad->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Удалить рекламу (владелец или админ, слот недели не возвращается).
     *
     * Пост в UFlow и копии в районах чистятся каскадом по FK.
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
     * Квота размещений в районах для кабинета.
     *
     * @param Request $request запрос владельца
     * @return JsonResponse used/limit/left
     */
    public function districtQuota(Request $request): JsonResponse
    {
        $business = $this->ownedBusiness($request);

        $used = BusinessAd::districtPlacementsThisWeek($business->id);

        return response()->json([
            'used' => $used,
            'limit' => self::DISTRICT_WEEKLY_LIMIT,
            'left' => max(0, self::DISTRICT_WEEKLY_LIMIT - $used),
        ]);
    }

    /**
     * Разместить рекламу в районах организации.
     *
     * Район доступен, когда организация — его житель (владелец или
     * принятый участник). Квота — DISTRICT_WEEKLY_LIMIT размещений
     * за скользящие 7 дней на бизнес (429 при превышении).
     * Повторное размещение в тот же район пропускается.
     * Жители района уведомляются как об обычной новости.
     *
     * @param Request $request запрос с district_ids[]
     * @param BusinessAd $ad реклама кабинета
     * @return JsonResponse placed/skipped/quota
     */
    public function placeInDistricts(Request $request, BusinessAd $ad): JsonResponse
    {
        $user = $request->user();

        abort_unless($ad->user_id === $user->id || $user->isAdmin(), 403, 'Размещение — только своей рекламы');

        $business = Business::whereKey($ad->business_id)->first();

        abort_if($business === null, 404, 'Бизнес-профиль не найден');
        abort_unless($business->isVerified() || $user->isAdmin(), 403, 'Размещение доступно после проверки компании по УНП');

        $data = $request->validate([
            'district_ids' => 'required|array|min:1|max:20',
            'district_ids.*' => 'integer|exists:districts,id',
        ]);

        $districtIds = array_values(array_unique(array_map('intval', $data['district_ids'])));

        $districts = \App\Models\District::whereIn('id', $districtIds)->get()->keyBy('id');

        $placed = [];
        $skipped = [];

        foreach ($districtIds as $districtId) {
            $district = $districts->get($districtId);

            if (! $district || ! $district->isResident($user->id)) {
                $skipped[] = ['district_id' => $districtId, 'reason' => 'Организация не вступила в район'];
                continue;
            }

            $exists = \App\Models\DistrictPost::where('business_ad_id', $ad->id)
                ->where('district_id', $districtId)
                ->exists();

            if ($exists) {
                $skipped[] = ['district_id' => $districtId, 'reason' => 'Уже размещена'];
                continue;
            }

            $used = BusinessAd::districtPlacementsThisWeek($business->id);

            abort_if(
                $used >= self::DISTRICT_WEEKLY_LIMIT,
                429,
                'Без спама: максимум '.self::DISTRICT_WEEKLY_LIMIT.' размещения в районах в неделю.'
            );

            try {
                $post = \App\Models\DistrictPost::create([
                    'district_id' => $districtId,
                    'business_ad_id' => $ad->id,
                    'user_id' => $user->id,
                    'title' => $ad->title,
                    'body' => $ad->body,
                ]);

                broadcast(new \App\Events\DistrictUpdated($district))->toOthers();
                \App\Services\DistrictNotifier::postPublished($post->refresh());

                $placed[] = $districtId;
            } catch (\Throwable $e) {
                \Log::warning('business ad district place failed', ['ad_id' => $ad->id, 'district_id' => $districtId]);

                $skipped[] = ['district_id' => $districtId, 'reason' => 'Не получилось разместить'];
            }
        }

        $quota = BusinessAd::districtPlacementsThisWeek($business->id);

        return response()->json([
            'placed' => $placed,
            'skipped' => $skipped,
            'quota' => [
                'used' => $quota,
                'limit' => self::DISTRICT_WEEKLY_LIMIT,
                'left' => max(0, self::DISTRICT_WEEKLY_LIMIT - $quota),
            ],
        ]);
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
