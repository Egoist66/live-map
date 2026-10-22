<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'endpoint' => 'required|string|max:500',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
            'encoding' => 'sometimes|string|max:16',
        ]);

        PushSubscription::updateOrCreate(
            ['endpoint' => $data['endpoint']],
            [
                'user_id' => $request->user()->id,
                'p256dh_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'encoding' => $data['encoding'] ?? 'aesgcm',
            ]
        );

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request)
    {
        $data = $request->validate(['endpoint' => 'required|string|max:500']);

        PushSubscription::where('user_id', $request->user()->id)
            ->where('endpoint', $data['endpoint'])
            ->delete();

        return response()->json(['ok' => true]);
    }

    public function test(Request $request, WebPushService $push)
    {
        $sent = $push->sendToUser($request->user(), [
            'title' => 'ULove',
            'body' => 'Системные уведомления включены',
            'url' => '/chat',
            'tag' => 'upin-test',
        ]);

        return response()->json(['ok' => true, 'sent' => $sent, 'configured' => $push->isConfigured()]);
    }
}
