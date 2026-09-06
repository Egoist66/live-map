<?php

namespace App\Http\Controllers;

use App\Events\PinCreated;
use App\Events\PinDeleted;
use App\Events\PinUpdated;
use App\Models\Pin;
use App\Services\ContentModeration;
use App\Services\CountryResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class PinController extends Controller
{
    public function index(Request $request)
    {
        $lat = (float) $request->input('lat', 55.7558);
        $lng = (float) $request->input('lng', 37.6173);
        $radius = (int) $request->input('radius', Auth::user()?->pinRadius() ?? 1000) / 1000;
        $viewerId = Auth::id();

        $q = Pin::active()->nearby($lat, $lng, $radius);
        $viewer = Auth::user();
        $q->visibleForGender($viewer);
        $hiddenUsers = $viewer ? \App\Models\User::hiddenFromSearchFor($viewer) : array_merge(\App\Models\User::where('is_hidden_from_search', true)->pluck('id')->all(), [\App\Models\User::GHOST_USER_ID]);
        if (!empty($hiddenUsers)) $q->whereNotIn('user_id', is_array($hiddenUsers) ? $hiddenUsers : $hiddenUsers->all());
        if ($viewerId) {
            $blocked = \App\Models\UserBlock::where('blocker_id', $viewerId)->pluck('blocked_id');
            $blockedBy = \App\Models\UserBlock::where('blocked_id', $viewerId)->pluck('blocker_id');
            $hide = $blocked->merge($blockedBy)->unique()->filter();
            if ($hide->isNotEmpty()) $q->whereNotIn('user_id', $hide);
        }
        $pins = $q->boostedFirst()->with('user:id,name,avatar_path,level')->limit(100)->get();
        $myReactions = $viewerId ? \App\Models\Reaction::where('user_id', $viewerId)->where('reactable_type', 'pin')->whereIn('reactable_id', $pins->pluck('id'))->pluck('type', 'reactable_id') : collect();
        return response()->json($pins->map(fn($p) => array_merge($p->toPublicArray($viewerId), ['my_reaction' => $myReactions[$p->id] ?? null])));
    }

    public function mine(Request $request)
    {
        $user = $request->user();
        $pins = Pin::where('user_id', $user->id)->whereIn('status', ['active', 'scheduled'])->latest()->limit(50)->with('user:id,name,avatar_path,level')->get();
        $myReactions = \App\Models\Reaction::where('user_id', $user->id)->where('reactable_type', 'pin')->whereIn('reactable_id', $pins->pluck('id'))->pluck('type', 'reactable_id');
        return response()->json($pins->map(fn($p) => array_merge($p->toPublicArray($user->id), ['my_reaction' => $myReactions[$p->id] ?? null])));
    }

    public function archived(Request $request)
    {
        $user = $request->user();
        $pins = Pin::where('user_id', $user->id)
            ->where(fn($q) => $q->whereIn('status', ['expired', 'archived'])->orWhere('expires_at', '<=', now()))
            ->latest()->limit(50)->with('user:id,name,avatar_path,level')->get();
        return response()->json($pins->map(fn($p) => $p->toPublicArray($user->id)));
    }

    public function scheduled(Request $request)
    {
        $user = $request->user();
        $pins = Pin::where('user_id', $user->id)->scheduled()->latest('publish_at')->limit(50)->with('user:id,name,avatar_path,level')->get();
        return response()->json($pins->map(fn($p) => $p->toPublicArray($user->id)));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        abort_unless($user->canCreatePin(), 429, 'Лимит free тарифа: максимум 3 живых пина. Истёкшие и удалённые освобождают место — дождись или удали лишний.');

        $data = $request->validate([
            'title' => 'required|string|max:100',
            'body' => 'nullable|string|max:1000',
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
        ]);

        CountryResolver::assertPinAllowed($user, (float) $data['latitude'], (float) $data['longitude'], isset($data['user_lat']) ? (float) $data['user_lat'] : null, isset($data['user_lng']) ? (float) $data['user_lng'] : null);
        unset($data['user_lat'], $data['user_lng']);

        ContentModeration::assertClean($data['title'] ?? null, $data['body'] ?? null);
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
        if (! $isScheduled) {
            broadcast(new PinCreated($pin))->toOthers();
        }

        return response()->json(array_merge($pin->toPublicArray($user->id), ['my_reaction' => null]), 201);
    }

    public function update(Request $request, Pin $pin)
    {
        $this->authorize('update', $pin);
        $data = $request->validate([
            'title' => 'sometimes|required|string|max:100',
            'body' => 'nullable|string|max:1000',
            'category' => ['sometimes', 'required', 'string', 'max:32', 'regex:/^[a-z0-9_]+$/i', function ($attr, $val, $fail) use ($request) {
                $v = Pin::normalizeCategory($val);
                if (!Pin::canUseCategory($request->user(), $v)) {
                    $fail('Свои категории доступны на тарифе Pro и выше.');
                }
            }],
            'publish_at' => 'sometimes|nullable|date|after:now|before:+31 days',
            'gender_audience' => 'sometimes|in:all,male,female',
        ]);
        if (array_key_exists('category', $data)) $data['category'] = Pin::normalizeCategory($data['category']);
        if (array_key_exists('gender_audience', $data)) $data['gender_audience'] = Pin::normalizeGenderAudience($data['gender_audience']);
        ContentModeration::assertClean($data['title'] ?? $pin->title, array_key_exists('body', $data) ? $data['body'] : $pin->body);
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
}
