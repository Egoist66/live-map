<?php

namespace App\Http\Controllers;

use App\Events\PinCreated;
use App\Events\PinDeleted;
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

        $pins = Pin::active()->where('status', 'active')->nearby($lat, $lng, $radius)->boostedFirst()->with('user:id,name,avatar_path,level')->limit(100)->get();
        $viewerId = Auth::id();
        return response()->json($pins->map(fn($p) => $p->toPublicArray($viewerId)));
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
            'location_precision' => 'sometimes|in:blur_200,exact,district',
            'is_anonymous' => 'sometimes|boolean',
            'photo_path' => 'sometimes|nullable|string|max:255',
        ]);

        $precision = $data['location_precision'] ?? 'blur_200';
        $origLat = (float) $data['latitude'];
        $origLng = (float) $data['longitude'];
        if ($precision === 'blur_200') {
            [$blurLat, $blurLng] = Pin::blurCoords($origLat, $origLng, 200);
            $data['real_lat'] = $origLat;
            $data['real_lng'] = $origLng;
            $data['latitude'] = $blurLat;
            $data['longitude'] = $blurLng;
        } elseif ($precision === 'exact') {
            $data['real_lat'] = $origLat;
            $data['real_lng'] = $origLng;
        }

        $data['user_id'] = $user->id;
        $data['radius_meters'] = $user->pinRadius();
        $data['visibility_radius_km'] = (int) ($user->pinRadius() / 1000);
        $data['expires_at'] = now()->addHours($user->pinTtlHours());
        $data['is_anonymous'] = $data['is_anonymous'] ?? $user->is_anonymous_default;
        $data['status'] = 'active';

        $pin = Pin::create($data);

        if ($user->pins_today_date?->toDateString() !== now()->toDateString()) {
            $user->update(['pins_today_date' => now()->toDateString(), 'pins_today_count' => 1]);
        } else {
            $user->increment('pins_today_count');
        }

        broadcast(new PinCreated($pin->load('user')))->toOthers();

        return response()->json($pin, 201);
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
        return response()->json($boost, 201);
    }
}
