<?php

namespace App\Services;

use App\Events\BusinessRejected;
use App\Events\BusinessVerificationSubmitted;
use App\Events\BusinessVerified;
use App\Models\Business;
use App\Models\Pin;
use App\Models\PinView;
use App\Models\User;
use App\Notifications\BusinessRejectedNotification;
use App\Notifications\BusinessSubmittedNotification;
use App\Notifications\BusinessVerifiedNotification;
use Illuminate\Support\Facades\DB;

/**
 * Сервис кабинета бизнеса: профиль, верификация РБ, дашборд.
 */
class BusinessService
{
    /**
     * Профиль владельца (создаёт черновик при отсутствии).
     *
     * @param User $user владелец
     * @return Business
     */
    public function profileFor(User $user): Business
    {
        $existing = Business::where('user_id', $user->id)
            ->orderByDesc('id')
            ->first();

        if ($existing) {
            return $existing;
        }

        return Business::create([
            'user_id' => $user->id,
            'name' => $user->name ?? 'Мой бизнес',
            'lat' => $user->home_lat,
            'lng' => $user->home_lng,
            'address' => $user->home_city,
            'is_active' => true,
            'verification_status' => 'draft',
            'subscription_plan' => 'free',
        ]);
    }

    /**
     * Обновить профиль бизнеса.
     *
     * @param User $user владелец
     * @param array<string, mixed> $data валидированные поля
     * @return Business
     */
    public function updateProfile(User $user, array $data): Business
    {
        $business = $this->profileFor($user);

        abort_unless(
            $business->user_id === $user->id || $user->isAdmin(),
            403,
            'Нет доступа к бизнесу'
        );

        $allowed = $this->filterProfileData($data);

        $business->fill($allowed);

        if ($business->isDirty() && $business->verification_status === 'verified') {
            $sensitive = array_intersect_key($allowed, array_flip(['unp', 'legal_form', 'name']));

            if (! empty($sensitive)) {
                $business->verification_status = 'pending';
                $business->verified_at = null;
            }
        }

        $business->save();

        return $business->fresh();
    }

    /**
     * Отправить профиль на проверку (draft|rejected → pending).
     *
     * Повторная отправка той же заявки запрещена: если статус уже
     * pending — отвечаем 409 с понятным текстом, фронт показывает
     * предупреждение «уже на проверке» вместо тихого ресабмита.
     *
     * @param User $user владелец
     * @return Business
     */
    public function submitForVerification(User $user): Business
    {
        $business = $this->profileFor($user);

        abort_unless($business->user_id === $user->id || $user->isAdmin(), 403);

        abort_if($business->isVerified(), 422, 'Бизнес уже проверен');

        abort_if(
            $business->isPending(),
            409,
            'Заявка уже на проверке — дождитесь решения модерации'
        );

        $this->assertReadyForVerification($business);

        $business->forceFill([
            'verification_status' => 'pending',
            'verification_notes' => null,
        ])->save();

        $fresh = $business->fresh();

        try {
            broadcast(new BusinessVerificationSubmitted($fresh))->toOthers();
        } catch (\Throwable $e) {
            \Log::warning('business.verify broadcast failed', ['id' => $business->id]);
        }

        $this->notifyStaffSubmitted($fresh);

        return $fresh;
    }

    /**
     * Верифицировать бизнес (админ или модератор).
     *
     * @param Business $business
     * @param User $admin staff (admin|moderator)
     * @return Business
     */
    public function verify(Business $business, User $admin): Business
    {
        abort_unless($admin->isModerator(), 403, 'Проверка бизнеса — только для модерации');

        $business->forceFill([
            'verification_status' => 'verified',
            'verified_at' => now(),
            'verification_notes' => null,
        ])->save();

        $fresh = $business->fresh();

        try {
            broadcast(new BusinessVerified($fresh))->toOthers();
        } catch (\Throwable $e) {
            \Log::warning('business.verified broadcast failed', ['id' => $business->id]);
        }

        $this->notifyOwnerVerified($fresh);

        return $fresh;
    }

    /**
     * Отклонить с причиной (админ или модератор).
     *
     * @param Business $business
     * @param User $admin staff (admin|moderator)
     * @param string $reason
     * @return Business
     */
    public function reject(Business $business, User $admin, string $reason): Business
    {
        abort_unless($admin->isModerator(), 403, 'Проверка бизнеса — только для модерации');

        $clean = mb_substr(trim($reason), 0, 1000);

        abort_if($clean === '', 422, 'Укажите причину отказа');

        $business->forceFill([
            'verification_status' => 'rejected',
            'verification_notes' => $clean,
            'verified_at' => null,
        ])->save();

        $fresh = $business->fresh();

        try {
            broadcast(new BusinessRejected($fresh))->toOthers();
        } catch (\Throwable $e) {
            \Log::warning('business.rejected broadcast failed', ['id' => $business->id]);
        }

        $this->notifyOwnerRejected($fresh);

        return $fresh;
    }

    /**
     * Дашборд кабинета: профиль + пины + просмотры + подсказки заработка.
     *
     * @param User $user владелец
     * @return array<string, mixed>
     */
    public function dashboardFor(User $user): array
    {
        $business = $this->profileFor($user);

        $pinsQuery = Pin::where('user_id', $user->id);

        $liveCount = (clone $pinsQuery)
            ->whereIn('status', ['active', 'scheduled'])
            ->where(function ($w) {
                $w->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->count();

        $totalPins = (clone $pinsQuery)->count();

        $pinIds = (clone $pinsQuery)->pluck('id');

        $viewsTotal = 0;
        $viewsWeek = 0;

        if ($pinIds->isNotEmpty()) {
            $viewsTotal = PinView::whereIn('pin_id', $pinIds)->count();

            $viewsWeek = PinView::whereIn('pin_id', $pinIds)
                ->where('created_at', '>=', now()->subDays(7))
                ->count();
        }

        $likesTotal = (clone $pinsQuery)->sum('likes_count');
        $commentsTotal = (clone $pinsQuery)->sum('comments_count');

        $recentPins = (clone $pinsQuery)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn (Pin $pin) => $pin->toPublicArray())
            ->values()
            ->all();

        $isVerified = $business->isVerified();

        $recentAds = \App\Models\BusinessAd::where('business_id', $business->id)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn (\App\Models\BusinessAd $ad) => $ad->toPublicArray())
            ->values()
            ->all();

        $adsUsed = \App\Models\BusinessAd::usedThisWeek($business->id);
        $adsLimit = \App\Http\Controllers\BusinessAdController::WEEKLY_LIMIT;

        return [
            'business' => $business->toCabinetArray(),
            'stats' => [
                'views_total' => (int) $viewsTotal,
                'views_week' => (int) $viewsWeek,
                'pins_live' => (int) $liveCount,
                'pins_total' => (int) $totalPins,
                'likes_total' => (int) $likesTotal,
                'comments_total' => (int) $commentsTotal,
            ],
            'recent_pins' => $recentPins,
            'recent_ads' => $recentAds,
            'ads_quota' => [
                'used' => $adsUsed,
                'limit' => $adsLimit,
                'left' => max(0, $adsLimit - $adsUsed),
            ],
            'earn' => $this->earnHints($business, (int) $viewsWeek, (int) $liveCount),
        ];
    }

    /**
     * Подсказки заработка для бизнеса и платформы.
     *
     * @param Business $business
     * @param int $viewsWeek
     * @param int $liveCount
     * @return array<int, array<string, string>>
     */
    private function earnHints(Business $business, int $viewsWeek, int $liveCount): array
    {
        $hints = [];

        if (! $business->isVerified()) {
            $hints[] = [
                'key' => 'verify',
                'title' => 'Пройдите проверку по УНП',
                'text' => 'Верифицированные получают бейдж «Проверено», бессрочные пины и пуш-рассылку по району.',
            ];
        }

        if ($liveCount === 0) {
            $hints[] = [
                'key' => 'first_pin',
                'title' => 'Создайте первый рекламный пин',
                'text' => 'Пин на 7 дней в радиусе — от $9.99. Видите просмотры, клики и маршруты.',
            ];
        }

        if ($viewsWeek > 50) {
            $hints[] = [
                'key' => 'push',
                'title' => 'Пуш по району — горячая аудитория',
                'text' => 'У вас уже смотрят. Пуш-уведомление подписчикам зоны — от $14.99.',
            ];
        }

        $hints[] = [
            'key' => 'coupon',
            'title' => 'Акция с кнопкой «Маршрут»',
            'text' => 'Купон $4.99 приводит ногами: клиент строит маршрут прямо из пина.',
        ];

        return $hints;
    }

    /**
     * Разослать inbox-уведомления staff (админы + модераторы) о новой заявке.
     *
     * Websocket может не дойти (polling-режим, офлайн) — inbox
     * подхватывается RealtimeController::sync и тостом useAppNotifications.
     *
     * @param Business $business заявка в pending
     * @return void
     */
    private function notifyStaffSubmitted(Business $business): void
    {
        try {
            $staff = User::where('is_admin', true)
                ->orWhere('role', 'admin')
                ->orWhere('role', 'moderator')
                ->get();

            foreach ($staff as $member) {
                \App\Services\UserNotifier::send(
                    $member,
                    new BusinessSubmittedNotification($business)
                );
            }
        } catch (\Throwable $e) {
            \Log::warning('business.submitted notify failed', ['id' => $business->id]);
        }
    }

    /**
     * Уведомить владельца о пройденной проверке (inbox + push).
     *
     * @param Business $business проверенный бизнес
     * @return void
     */
    private function notifyOwnerVerified(Business $business): void
    {
        try {
            $owner = $business->user ?? User::find($business->user_id);

            if ($owner) {
                \App\Services\UserNotifier::send(
                    $owner,
                    new BusinessVerifiedNotification($business)
                );
            }
        } catch (\Throwable $e) {
            \Log::warning('business.verified notify failed', ['id' => $business->id]);
        }
    }

    /**
     * Уведомить владельца об отказе (inbox + push, с причиной).
     *
     * @param Business $business отклонённый бизнес
     * @return void
     */
    private function notifyOwnerRejected(Business $business): void
    {
        try {
            $owner = $business->user ?? User::find($business->user_id);

            if ($owner) {
                \App\Services\UserNotifier::send(
                    $owner,
                    new BusinessRejectedNotification($business)
                );
            }
        } catch (\Throwable $e) {
            \Log::warning('business.rejected notify failed', ['id' => $business->id]);
        }
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function filterProfileData(array $data): array
    {
        $keys = [
            'name', 'brand', 'category', 'legal_form', 'unp', 'reg_number',
            'address', 'legal_address', 'director_name', 'lat', 'lng',
            'description', 'services', 'phone', 'website', 'working_hours', 'is_active',
        ];

        $out = [];

        foreach ($keys as $key) {
            if (array_key_exists($key, $data)) {
                $out[$key] = $data[$key];
            }
        }

        return $out;
    }

    /**
     * @param Business $business
     * @return void
     */
    private function assertReadyForVerification(Business $business): void
    {
        abort_if(empty($business->name) || mb_strlen($business->name) < 2, 422, 'Укажите название компании');

        abort_if(! in_array($business->legal_form, Business::LEGAL_FORMS, true), 422, 'Укажите форму собственности');

        $unp = (string) ($business->unp ?? '');

        abort_if(! preg_match('/^\d{9}$/', $unp), 422, 'УНП — 9 цифр');

        abort_if(empty($business->legal_address), 422, 'Укажите юридический адрес');
    }
}
