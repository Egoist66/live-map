<?php

namespace App\Http\Controllers;

use App\Events\PinCreated;
use App\Events\PinDeleted;
use App\Events\PinUpdated;
use App\Models\Pin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PinController extends Controller
{
    public function index(Request $request)
    {
        $lat = (float) $request->input('lat', 55.7558);
        $lng = (float) $request->input('lng', 37.6173);
        $radius = (int) $request->input('radius', Auth::user()?->pinRadius() ?? 1000) / 1000;
        $viewerId = Auth::id();

        $q = Pin::active()->where('status', 'active')->nearby($lat, $lng, $radius);
        $viewer = Auth::user();
        $hiddenUsers = $viewer ? \App\Models\User::hiddenFromSearchFor($viewer) : \App\Models\User::where('is_hidden_from_search', true)->pluck('id')->all();
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
        $pins = Pin::where('user_id', $user->id)->where('status', 'active')->latest()->limit(50)->with('user:id,name,avatar_path,level')->get();
        $myReactions = \App\Models\Reaction::where('user_id', $user->id)->where('reactable_type', 'pin')->whereIn('reactable_id', $pins->pluck('id'))->pluck('type', 'reactable_id');
        return response()->json($pins->map(fn($p) => array_merge($p->toPublicArray($user->id), ['my_reaction' => $myReactions[$p->id] ?? null])));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        abort_unless($user->canCreatePin(), 429, 'Лимит 3 пина в день для free тарифа');

        $data = $request->validate([
            'title' => 'required|string|max:100',
            'body' => 'nullable|string|max:1000',
            'category' => 'required|in:question,announcement,warning,event,offer,help',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'location_precision' => 'sometimes|in:blur_200,exact,district,custom',
            'blur_meters' => 'sometimes|integer|min:0|max:5000',
            'is_anonymous' => 'sometimes|boolean',
            'photo_path' => 'sometimes|nullable|string|max:255',
            'radius_meters' => 'sometimes|integer|min:500|max:50000',
        ]);

        $precision = $data['location_precision'] ?? $user->default_location_precision ?? 'blur_200';
        if (!in_array($precision, ['blur_200', 'exact', 'district', 'custom'], true)) $precision = 'blur_200';
        $meters = isset($data['blur_meters']) ? (int) $data['blur_meters'] : (int) ($user->default_blur_meters ?? 200);
        $meters = max(0, min(5000, $meters));
        $origLat = (float) $data['latitude'];
        $origLng = (float) $data['longitude'];
        if ($precision === 'exact' || ($precision === 'custom' && $meters <= 0)) {
            $precision = 'exact';
            $data['real_lat'] = $origLat;
            $data['real_lng'] = $origLng;
        } elseif ($precision === 'custom') {
            [$blurLat, $blurLng] = Pin::blurCoords($origLat, $origLng, $meters);
            $data['real_lat'] = $origLat;
            $data['real_lng'] = $origLng;
            $data['latitude'] = $blurLat;
            $data['longitude'] = $blurLng;
            $data['meta'] = ['blur_meters' => $meters];
        } elseif ($precision === 'blur_200') {
            [$blurLat, $blurLng] = Pin::blurCoords($origLat, $origLng, 200);
            $data['real_lat'] = $origLat;
            $data['real_lng'] = $origLng;
            $data['latitude'] = $blurLat;
            $data['longitude'] = $blurLng;
        } elseif ($precision === 'district') {
            [$blurLat, $blurLng] = Pin::blurCoords($origLat, $origLng, 1200);
            $data['real_lat'] = $origLat;
            $data['real_lng'] = $origLng;
            $data['latitude'] = $blurLat;
            $data['longitude'] = $blurLng;
        }
        $data['location_precision'] = $precision;
        unset($data['blur_meters']);

        $requestedRadius = (int) ($data['radius_meters'] ?? 1000);
        $maxRadius = $user->pinRadius();
        $finalRadius = max(500, min($requestedRadius, $maxRadius));
        $data['user_id'] = $user->id;
        $data['radius_meters'] = $finalRadius;
        $data['visibility_radius_km'] = (int) max(1, round($finalRadius / 1000));
        $data['expires_at'] = now()->addHours($user->pinTtlHours());
        $data['is_anonymous'] = $data['is_anonymous'] ?? $user->is_anonymous_default;
        $data['status'] = 'active';

        $pin = Pin::create($data);

        if ($user->pins_today_date?->toDateString() !== now()->toDateString()) {
            $user->update(['pins_today_date' => now()->toDateString(), 'pins_today_count' => 1]);
        } else {
            $user->increment('pins_today_count');
        }

        $pin->load('user:id,name,avatar_path,level');
        broadcast(new PinCreated($pin))->toOthers();

        return response()->json(array_merge($pin->toPublicArray($user->id), ['my_reaction' => null]), 201);
    }

    public function update(Request $request, Pin $pin)
    {
        $this->authorize('update', $pin);
        $data = $request->validate([
            'title' => 'sometimes|required|string|max:100',
            'body' => 'nullable|string|max:1000',
            'category' => 'sometimes|required|in:question,announcement,warning,event,offer,help',
        ]);
        $pin->update($data);
        $pin->load('user:id,name,avatar_path,level');
        try { broadcast(new PinUpdated($pin))->toOthers(); } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        $my = \App\Models\Reaction::where('user_id', $request->user()->id)->where('reactable_type','pin')->where('reactable_id',$pin->id)->value('type');
        return response()->json(array_merge($pin->toPublicArray($request->user()->id), ['my_reaction' => $my]));
    }

    public function destroy(Pin $pin)
    {
        $this->authorize('delete', $pin);
        $pin->delete();
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
            'expires_at' => $data['type']==='extend' ? $pin->expires_at->addDay() : $pin->expires_at,
        ]);
        $pin->load('user:id,name,avatar_path,level');
        try { broadcast(new PinUpdated($pin))->toOthers(); } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json($boost, 201);
    }
}
