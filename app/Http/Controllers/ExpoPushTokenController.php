<?php

namespace App\Http\Controllers;

use App\Models\ExpoPushToken;
use App\Services\ExpoPushService;
use Illuminate\Http\Request;

class ExpoPushTokenController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'token' => 'required|string|max:255|starts_with:ExponentPushToken[',
            'platform' => 'sometimes|nullable|string|max:16',
        ]);

        ExpoPushToken::updateOrCreate(
            ['token' => $data['token']],
            ['user_id' => $request->user()->id, 'platform' => $data['platform'] ?? null]
        );

        \Illuminate\Support\Facades\Log::info('expo push token bound', ['user_id' => $request->user()->id]);

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request)
    {
        $data = $request->validate(['token' => 'required|string|max:255']);

        ExpoPushToken::where('user_id', $request->user()->id)
            ->where('token', $data['token'])
            ->delete();

        return response()->json(['ok' => true]);
    }

    public function test(Request $request, ExpoPushService $expo)
    {
        $sent = $expo->sendToUser($request->user(), [
            'title' => 'UPin',
            'body' => 'Системные уведомления включены',
            'url' => '/chat',
        ], 'upin-messages');

        return response()->json(['ok' => true, 'sent' => $sent]);
    }
}
