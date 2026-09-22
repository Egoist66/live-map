<?php

namespace App\Http\Controllers;

use App\Events\PinCreated;
use App\Events\PinDeleted;
use App\Events\PinUpdated;
use App\Models\Pin;
use App\Services\ActivityRewards;
use App\Services\ContentModeration;
use App\Services\CountryResolver;
use App\Services\HomeZoneService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class PinController extends Controller
{
    public function index(Request $request)
    {
        $viewer = Auth::user();
        $viewerId = Auth::id();

        // Публикацией запланированных занимается scheduler (pins:publish каждую
        // минуту) — из read-пути убрано, чтобы скролл карты не делал write-запросы.
        $liveLat = $request->filled('user_lat') ? (float) $request->input('user_lat') : null;
        $liveLng = $request->filled('user_lng') ? (float) $request->input('user_lng') : null;

        $memberDistrictIds = $this->memberDistrictIds($viewerId);

        if ($viewer && !$viewer->isAdmin()) {
            $zone = \App\Services\HomeZoneService::zoneFor($viewer, $liveLat, $liveLng);
            if ($zone === null) {
                return response()->json([]);
            }
            $lat = $zone['lat'];
            $lng = $zone['lng'];
            $reqRadiusKm = (int) $request->input('radius', $viewer->pinRadius()) / 1000;
            $radius = (int) max(1, min($reqRadiusKm, $zone['radiusKm'], $viewer->pinRadius() / 1000));
        } else {
            $lat = (float) $request->input('lat', 55.7558);
            $lng = (float) $request->input('lng', 37.6173);
            $radius = (int) $request->input('radius', $viewer?->pinRadius() ?? 1000) / 1000;
        }

        $q = Pin::active()->nearby($lat, $lng, $radius);
        $q->visibleForGender($viewer);
        $hiddenUsers = $viewer ? \App\Models\User::hiddenFromSearchFor($viewer) : array_merge(\App\Models\User::where('is_hidden_from_search', true)->pluck('id')->all(), [\App\Models\User::GHOST_USER_ID]);
        if (!empty($hiddenUsers)) $q->whereNotIn('user_id', is_array($hiddenUsers) ? $hiddenUsers : $hiddenUsers->all());
        if ($viewerId) {
            $blocked = \App\Models\UserBlock::where('blocker_id', $viewerId)->pluck('blocked_id');
            $blockedBy = \App\Models\UserBlock::where('blocked_id', $viewerId)->pluck('blocker_id');
            $hide = $blocked->merge($blockedBy)->unique()->filter();
            if ($hide->isNotEmpty()) $q->whereNotIn('user_id', $hide);
        }
        $pins = $q->boostedFirst()->with('user:id,name,avatar_path,level,account_type')->limit(100)->get();
        $invitedIds = $viewerId ? \App\Models\PinInvite::where('invitee_id', $viewerId)->whereIn('pin_id', $pins->pluck('id'))->pluck('pin_id')->map(fn($v) => (int) $v)->flip() : collect();
        $visible = $pins->filter(function ($p) use ($viewer, $viewerId, $liveLat, $liveLng, $invitedIds, $memberDistrictIds) {
            $districtId = (int) ($p->district_id ?? 0);
            $isOwner = $viewerId && (int) $p->user_id === (int) $viewerId;
            if ($districtId > 0 && !$isOwner && !isset($memberDistrictIds[$districtId])) {
                return false;
            }
            if ($isOwner || isset($invitedIds[(int) $p->id])) {
                if ($districtId > 0 && !$isOwner && !isset($memberDistrictIds[$districtId])) {
                    return false;
                }
                return true;
            }
            return \App\Services\PinVisibility::canView($viewer, $p, $liveLat, $liveLng);
        })->values();
        try {
            $sosExtra = Pin::active()
                ->where('category', 'sos')
                ->whereNotIn('id', $visible->pluck('id')->all() ?: [0])
                ->with('user:id,name,avatar_path,level,account_type')
                ->limit(20)
                ->get()
                ->filter(fn ($p) => \App\Services\PinVisibility::canView($viewer, $p, $liveLat, $liveLng));
            $visible = $visible->concat($sosExtra)->values();
        } catch (\Throwable) {
        }
        $allInvitedIds = collect();
        if ($viewerId) {
            try {
                $knownIds = $visible->pluck('id')->all() ?: [0];
                $invitedExtra = Pin::active()
                    ->whereIn('id', \App\Models\PinInvite::where('invitee_id', $viewerId)->select('pin_id'))
                    ->whereNotIn('id', $knownIds)
                    ->with('user:id,name,avatar_path,level,account_type')
                    ->limit(50)
                    ->get()
                    ->filter(function ($p) use ($viewer, $memberDistrictIds, $viewerId) {
                        $districtId = (int) ($p->district_id ?? 0);
                        $isOwner = $viewerId && (int) $p->user_id === (int) $viewerId;
                        if ($districtId > 0 && !$isOwner && !isset($memberDistrictIds[$districtId])) {
                            return false;
                        }
                        return $p->isVisibleForGender($viewer);
                    });
                $visible = $visible->concat($invitedExtra)->values();
                $allInvitedIds = \App\Models\PinInvite::where('invitee_id', $viewerId)
                    ->whereIn('pin_id', $visible->pluck('id'))
                    ->pluck('pin_id')
                    ->map(fn ($v) => (int) $v)
                    ->flip();
            } catch (\Throwable) {
            }
        }
        if ($viewerId) {
            try {
                $sosActive = \App\Services\SosService::activeFor($viewer);
                if ($sosActive) {
                    $sosPinId = (int) $sosActive->pin_id;
                    $visible = $visible->filter(fn ($p) => (int) $p->id === $sosPinId)->values();
                }
            } catch (\Throwable) {
            }
        }
        $myReactions = $viewerId ? \App\Models\Reaction::where('user_id', $viewerId)->where('reactable_type', 'pin')->whereIn('reactable_id', $visible->pluck('id'))->pluck('type', 'reactable_id') : collect();
        $this->attachCompanies($visible);
        return response()->json($visible->map(function ($p) use ($viewerId, $myReactions, $allInvitedIds) {
            $isInvited = $viewerId && isset($allInvitedIds[(int) $p->id]);
            return array_merge($p->toPublicArray($viewerId, (bool) $isInvited), ['my_reaction' => $myReactions[$p->id] ?? null]);
        }));
    }

    /**
     * Прикрепить визитки компаний к бизнес-пинам одним запросом.
     *
     * Маркер бизнеса на карте показывает логотип + бренд + бейдж
     * проверки: без батча каждый пин тянул бы свой Business (N+1).
     * Не бизнес-пины и владельцы без профиля получают company=null.
     *
     * @param \Illuminate\Support\Collection<int, Pin> $pins пины выдачи карты
     * @return void
     */
    private function attachCompanies($pins): void
    {
        $ownerIds = $pins->pluck('user_id')->filter()->map(fn ($v) => (int) $v)->unique()->values()->all();

        if ($ownerIds === []) {
            return;
        }

        $map = \App\Models\Business::briefMapForOwners($ownerIds);

        foreach ($pins as $pin) {
            $pin->setAttribute('company', $map[(int) $pin->user_id] ?? null);
        }
    }

    public function show(Request $request, Pin $pin)
    {
        $viewer = $request->user();
        $viewerId = $viewer?->id;
        if ($pin->user_id !== $viewerId && !$viewer?->isAdmin()) {
            if ($pin->status !== 'active' || ($pin->expires_at && $pin->expires_at->isPast())) {
                abort(404);
            }
            if (!$pin->isVisibleForGender($viewer)) {
                abort(403);
            }
            $liveLat = $request->filled('user_lat') ? (float) $request->input('user_lat') : null;
            $liveLng = $request->filled('user_lng') ? (float) $request->input('user_lng') : null;
            if (!\App\Services\PinVisibility::canView($viewer, $pin, $liveLat, $liveLng)) {
                abort(403, 'Пин вне вашей зоны или страны. Автор может прислать вам приглашение.');
            }
        }
        $pin->load('user:id,name,avatar_path,level');
        $my = $viewerId ? \App\Models\Reaction::where('user_id', $viewerId)->where('reactable_type', 'pin')->where('reactable_id', $pin->id)->value('type') : null;
        $isInvited = $viewerId ? \App\Services\PinVisibility::isInvited($pin, (int) $viewerId) : false;
        $this->attachCompanies(collect([$pin]));
        return response()->json(array_merge($pin->toPublicArray($viewerId, (bool) $isInvited), ['my_reaction' => $my]));
    }

    public function mine(Request $request)
    {
        $user = $request->user();
        $pins = Pin::where('user_id', $user->id)->whereIn('status', ['active', 'scheduled'])->latest()->limit(50)->with('user:id,name,avatar_path,level,account_type')->get();
        $myReactions = \App\Models\Reaction::where('user_id', $user->id)->where('reactable_type', 'pin')->whereIn('reactable_id', $pins->pluck('id'))->pluck('type', 'reactable_id');
        return response()->json($pins->map(fn($p) => array_merge($p->toPublicArray($user->id), ['my_reaction' => $myReactions[$p->id] ?? null])));
    }

    public function archived(Request $request)
    {
        $user = $request->user();
        $pins = Pin::where('user_id', $user->id)
            ->where(fn($q) => $q->whereIn('status', ['expired', 'archived'])->orWhere('expires_at', '<=', now()))
            ->latest()->limit(50)->with('user:id,name,avatar_path,level,account_type')->get();
        return response()->json($pins->map(fn($p) => $p->toPublicArray($user->id)));
    }

    public function scheduled(Request $request)
    {
        $user = $request->user();
        $pins = Pin::where('user_id', $user->id)->scheduled()->latest('publish_at')->limit(50)->with('user:id,name,avatar_path,level,account_type')->get();
        return response()->json($pins->map(fn($p) => $p->toPublicArray($user->id)));
    }

    public function store(Request $request)
    {
        $user = $request->user();

        if ($user->isBusinessAccount()) {
            $this->assertBusinessVerified($user);
        }

        abort_unless($user->canCreatePin(), 429, 'Лимит free тарифа: максимум 3 живых пина. Истёкшие и удалённые освобождают место — дождись или удали лишний.');

        $data = $request->validate([
            'title' => 'required|string|max:100',
            'body' => 'nullable|string|max:1000',
            'promo' => 'nullable|string|max:140',
            'category' => ['required', 'string', 'max:32', 'regex:/^[a-z0-9_]+$/i', function ($attr, $val, $fail) use ($user) {
                $v = Pin::normalizeCategory($val);
                if (!Pin::canUseCategory($user, $v)) {
                    $fail('Свои категории доступны на тарифе Pro и выше.');
                }
            }],
            'gender_audience' => 'sometimes|in:all,male,female',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'location_precision' => 'sometimes|in:blur_200,exact,district,custom',
            'blur_meters' => 'sometimes|integer|min:0|max:5000',
            'is_anonymous' => 'sometimes|boolean',
            'photo_path' => 'sometimes|nullable|string|max:255',
            'radius_meters' => 'sometimes|integer|min:500|max:500000',
            'publish_at' => 'sometimes|nullable|date|after:now|before:+31 days',
            'user_lat' => 'sometimes|nullable|numeric|between:-90,90',
            'user_lng' => 'sometimes|nullable|numeric|between:-180,180',
            'district_id' => 'sometimes|nullable|integer|exists:districts,id',
            'sos_confirmed' => 'sometimes|boolean',
        ]);

        $district = null;
        $districtId = isset($data['district_id']) ? (int) $data['district_id'] : 0;
        if ($districtId > 0) {
            $district = \App\Models\District::findOrFail($districtId);
            abort_unless($district->isResident($user->id) || $user->isAdmin(), 403, 'Пин района могут ставить только его жители.');
            $geometry = is_array($district->geometry) ? $district->geometry : [];
            $inside = \App\Services\DistrictService::containsPoint($geometry, (float) $data['latitude'], (float) $data['longitude']);
            abort_unless($inside, 422, 'Пин района должен стоять внутри его заливки.');
        }

        $sosCategory = Pin::isSosCategory($data['category'] ?? null);
        $sosConfirmed = (bool) ($data['sos_confirmed'] ?? false);
        unset($data['sos_confirmed']);
        abort_if($sosCategory && ! $sosConfirmed, 422, 'SOS-пин — только для реальной чрезвычайной ситуации. Вы несёте ответственность за ложное объявление: пользователи вправе пожаловаться администрации приложения и в соответствующие органы.');
        if ($sosCategory) {
            \App\Services\SosService::assertSosLimit($user);
        }

        CountryResolver::assertPinAllowed($user, (float) $data['latitude'], (float) $data['longitude'], isset($data['user_lat']) ? (float) $data['user_lat'] : null, isset($data['user_lng']) ? (float) $data['user_lng'] : null);
        HomeZoneService::assertInsideZone($user, (float) $data['latitude'], (float) $data['longitude'], isset($data['user_lat']) ? (float) $data['user_lat'] : null, isset($data['user_lng']) ? (float) $data['user_lng'] : null);
        unset($data['user_lat'], $data['user_lng']);
        $data['district_id'] = $district ? (int) $district->id : null;

        try {
            $resolved = CountryResolver::fromCoords((float) $data['latitude'], (float) $data['longitude']);
            if ($resolved) {
                $data['country'] = $resolved['country'];
                $data['country_code'] = $resolved['country_code'];
            }
        } catch (\Throwable) {
        }

        if (! $user->isBusinessAccount()) {
            unset($data['promo']);
        }
        ContentModeration::assertClean($data['title'] ?? null, $data['body'] ?? null, $data['promo'] ?? null);
        $data['category'] = Pin::normalizeCategory($data['category']);
        $data['gender_audience'] = Pin::normalizeGenderAudience($data['gender_audience'] ?? 'all');

        $precision = 'exact';
        $origLat = (float) $data['latitude'];
        $origLng = (float) $data['longitude'];
        $data['real_lat'] = $origLat;
        $data['real_lng'] = $origLng;
        $data['location_precision'] = $precision;
        unset($data['blur_meters']);

        $requestedRadius = (int) ($data['radius_meters'] ?? 1000);
        $maxRadius = $user->pinRadius();
        $finalRadius = max(500, min($requestedRadius, $maxRadius));
        $data['user_id'] = $user->id;
        $data['radius_meters'] = $finalRadius;
        $data['visibility_radius_km'] = (int) max(1, round($finalRadius / 1000));
        $publishAt = !empty($data['publish_at']) ? \Carbon\Carbon::parse($data['publish_at']) : null;
        $isScheduled = $publishAt && $publishAt->isFuture();
        $data['publish_at'] = $publishAt;
        $ttl = $user->pinTtlHours();
        $data['expires_at'] = $ttl === null ? null : ($isScheduled ? $publishAt->copy() : now())->addHours($ttl);
        $data['is_anonymous'] = $data['is_anonymous'] ?? $user->is_anonymous_default;
        $data['status'] = $isScheduled ? 'scheduled' : 'active';

        $pin = DB::transaction(function () use ($user, $data) {
            $locked = \App\Models\User::whereKey($user->id)->lockForUpdate()->first();
            abort_unless($locked->canCreatePin(), 429, 'Лимит free тарифа: максимум 3 живых пина. Истёкшие и удалённые освобождают место — дождись или удали лишний.');

            $created = Pin::create($data);

            if ($locked->pins_today_date?->toDateString() !== now()->toDateString()) {
                $locked->update(['pins_today_date' => now()->toDateString(), 'pins_today_count' => 1]);
            } else {
                $locked->increment('pins_today_count');
            }

            return $created;
        });

        $pin->load('user:id,name,avatar_path,level');
        if (Pin::isSosCategory($pin->category ?? null)) {
            \App\Services\SosService::callFor($pin);
        }
        if (! $isScheduled) {
            broadcast(new PinCreated($pin))->toOthers();
            try {
                \App\Services\UserSubscriptionNotifier::pinCreated($pin);
            } catch (\Throwable) {
            }
            try {
                if ((int) ($pin->district_id ?? 0) > 0) {
                    \App\Services\DistrictNotifier::pinCreated($pin->refresh());
                }
            } catch (\Throwable) {
            }
        }

        $response = array_merge($pin->toPublicArray($user->id), ['my_reaction' => null]);
        $reward = ActivityRewards::award($user, 'pin_create', 'pin', $pin->id);

        if ($reward !== null) {
            $response['reward'] = $reward;
        }

        return response()->json($response, 201);
    }

    public function update(Request $request, Pin $pin)
    {
        $this->authorize('update', $pin);
        $data = $request->validate([
            'title' => 'sometimes|required|string|max:100',
            'body' => 'nullable|string|max:1000',
            'promo' => 'nullable|string|max:140',
            'category' => ['sometimes', 'required', 'string', 'max:32', 'regex:/^[a-z0-9_]+$/i', function ($attr, $val, $fail) use ($request) {
                $v = Pin::normalizeCategory($val);
                if (!Pin::canUseCategory($request->user(), $v)) {
                    $fail('Свои категории доступны на тарифе Pro и выше.');
                }
            }],
            'publish_at' => 'sometimes|nullable|date|after:now|before:+31 days',
            'gender_audience' => 'sometimes|in:all,male,female',
            'sos_confirmed' => 'sometimes|boolean',
        ]);
        if (array_key_exists('category', $data)) $data['category'] = Pin::normalizeCategory($data['category']);
        $sosSwitch = array_key_exists('category', $data) && Pin::isSosCategory($data['category']);
        $sosConfirmed = (bool) ($data['sos_confirmed'] ?? $request->boolean('sos_confirmed'));
        unset($data['sos_confirmed']);
        abort_if($sosSwitch && ! $sosConfirmed, 422, 'SOS-пин — только для реальной чрезвычайной ситуации. Вы несёте ответственность за ложное объявление: пользователи вправе пожаловаться администрации приложения и в соответствующие органы.');
        if (array_key_exists('gender_audience', $data)) $data['gender_audience'] = Pin::normalizeGenderAudience($data['gender_audience']);
        if (! $request->user()->isBusinessAccount()) {
            unset($data['promo']);
        }
        ContentModeration::assertClean($data['title'] ?? $pin->title, array_key_exists('body', $data) ? $data['body'] : $pin->body, array_key_exists('promo', $data) ? $data['promo'] : $pin->promo);
        if ($pin->status === 'scheduled' && array_key_exists('publish_at', $data)) {
            $pin->publish_at = $data['publish_at'] ? \Carbon\Carbon::parse($data['publish_at']) : null;
            unset($data['publish_at']);
            if (! $pin->publish_at || $pin->publish_at->isPast()) {
                $pin->status = 'active';
                $pin->publish_at = null;
                $data['status'] = 'active';
            } else {
                $ttl = $request->user()->pinTtlHours();
                $pin->expires_at = $ttl === null ? null : $pin->publish_at->copy()->addHours($ttl);
            }
            $pin->save();
        }
        $pin->update($data);
        $pin->load('user:id,name,avatar_path,level');
        try { broadcast(new PinUpdated($pin))->toOthers(); } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        $my = \App\Models\Reaction::where('user_id', $request->user()->id)->where('reactable_type','pin')->where('reactable_id',$pin->id)->value('type');
        return response()->json(array_merge($pin->toPublicArray($request->user()->id), ['my_reaction' => $my]));
    }

    public function destroy(Pin $pin)
    {
        $this->authorize('delete', $pin);
        $isSos = \App\Models\Pin::isSosCategory($pin->category ?? null);
        if ($isSos) {
            try {
                \App\Services\SosService::cleanupConversationForPin($pin, 'deleted');
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('sos cleanup failed: '.$e->getMessage());
            }
        }
        $pin->comments()->delete();
        $pin->reactions()->delete();
        $pin->forceDelete();
        broadcast(new PinDeleted($pin->id))->toOthers();
        return response()->json(['ok' => true]);
    }

    public function boost(Request $request, Pin $pin)
    {
        $data = $request->validate(['type' => 'required|in:top,glow,notify,extend']);
        $prices = ['top'=>1,'glow'=>2,'notify'=>5,'extend'=>3];
        $boost = $pin->boosts()->create([
            'user_id' => $request->user()->id,
            'type' => $data['type'],
            'duration_hours' => $data['type']==='extend'?24:1,
            'price' => $prices[$data['type']],
            'starts_at' => now(),
            'ends_at' => now()->addHours($data['type']==='extend'?24:1),
        ]);
        $pin->update([
            'is_boosted' => true,
            'boosted_until' => $boost->ends_at,
            'expires_at' => $data['type']==='extend' && $pin->expires_at ? $pin->expires_at->addDay() : $pin->expires_at,
        ]);
        $pin->load('user:id,name,avatar_path,level');
        try { broadcast(new PinUpdated($pin))->toOthers(); } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json($boost, 201);
    }

    /**
     * Бизнес-аккаунт может ставить пины только после проверки по УНП.
     *
     * Пины бизнеса — витрина организации: видны всем пользователям карты
     * и всем сотрудникам в кабинете (BusinessController::pins по user_id
     * владельца). Без бейджа «Проверено» ставить их нельзя.
     *
     * @param \App\Models\User $user автор пина
     * @return void
     */
    private function assertBusinessVerified($user): void
    {
        try {
            $business = \App\Models\Business::where('user_id', $user->id)
                ->orderByDesc('id')
                ->first();
        } catch (\Throwable) {
            $business = null;
        }

        abort_if(! $business || ! $business->isVerified(), 403, 'Пины доступны после проверки компании по УНП. Отправьте реквизиты на проверку в кабинете — после одобрения модерацией сможете ставить пины.');
    }

    /**
     * Id районов, где пользователь житель (владелец + approved).
     *
     * @param int|null $viewerId кто смотрит
     * @return array<int,true> мапа id -> true для быстрой проверки
     */
    private function memberDistrictIds(?int $viewerId): array
    {
        if (!$viewerId) {
            return [];
        }

        $owned = \App\Models\District::where('user_id', $viewerId)->pluck('id');
        $member = \App\Models\DistrictMember::where('user_id', $viewerId)
            ->where('status', \App\Models\DistrictMember::STATUS_APPROVED)
            ->pluck('district_id');

        $ids = $owned->merge($member)->unique()->values();

        $map = [];
        foreach ($ids as $id) {
            $map[(int) $id] = true;
        }

        return $map;
    }
}
