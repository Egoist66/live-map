<?php

namespace App\Http\Controllers;

use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Регистрация FCM/APNs токенов нативных устройств.
 *
 * Web Push (push_subscriptions) не трогаем — сюда пишут
 * только iOS/Android через @capacitor/push-notifications.
 */
class DeviceTokenController extends Controller
{
    /**
     * Список моих устройств.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $tokens = DeviceToken::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('updated_at')
            ->limit(20)
            ->get(['id', 'platform', 'provider', 'updated_at']);

        return response()->json(['data' => $tokens]);
    }

    /**
     * Сохранить/обновить токен устройства.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'platform' => ['required', 'string', 'in:ios,android'],
            'provider' => ['nullable', 'string', 'in:fcm,apns'],
            'token' => ['required', 'string', 'max:512'],
        ]);

        $provider = $validated['provider'] ?? 'fcm';

        $device = DeviceToken::updateOrCreate(
            ['token' => $validated['token']],
            [
                'user_id' => $request->user()->id,
                'platform' => $validated['platform'],
                'provider' => $provider,
            ]
        );

        return response()->json(['data' => $device], 201);
    }

    /**
     * Удалить токен устройства (logout / отказ от пушей).
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:512'],
        ]);

        DeviceToken::query()
            ->where('user_id', $request->user()->id)
            ->where('token', $validated['token'])
            ->delete();

        return response()->json(['ok' => true]);
    }
}
