<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ZoneSubscriptionController extends Controller
{
    public function index(Request $request) { return $request->user()->zoneSubscriptions()->get(); }
    public function store(Request $request)
    {
        $data = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
            'radius_km' => 'required|integer|min:1|max:10',
            'types' => 'nullable|array',
            'notify_via' => 'sometimes|in:push,email,in_app',
        ]);
        $data['user_id'] = $request->user()->id;
        $sub = $request->user()->zoneSubscriptions()->create($data);
        return response()->json($sub, 201);
    }
    public function destroy(Request $request, $id) { $request->user()->zoneSubscriptions()->findOrFail($id)->delete(); return response()->json(['ok'=>true]); }
}
