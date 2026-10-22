<?php

namespace App\Http\Controllers;

use App\Models\ExpoPushToken;
use App\Services\ExpoPushService;
use Illuminate\Http\Request;

class ExpoPushTokenController extends Controller
{
    /**
     * Привязать Expo-пуш токен к текущему пользователю.
     *
     * Принимает оба формата Expo (ExponentPushToken[...] и ExpoPushToken[...]),
     * токен триммится — мобилка иногда присылает с пробелами/переносами.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255', 'regex:/^(ExponentPushToken|ExpoPushToken)\[.+\]$/'],
            'platform' => 'sometimes|nullable|string|max:32',
        ]);
        $token = trim($data['token']);

        ExpoPushToken::updateOrCreate(
            ['token' => $token],
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
        $tokensCount = ExpoPushToken::where('user_id', $request->user()->id)->count();
        $sent = $expo->sendToUser($request->user(), [
            'title' => 'ULove',
            'body' => 'Системные уведомления включены',
            'url' => '/chat',
        ], 'upin-messages');

        return response()->json(['ok' => true, 'sent' => $sent, 'tokens' => $tokensCount]);
    }
}
