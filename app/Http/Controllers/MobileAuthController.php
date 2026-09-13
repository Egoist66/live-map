<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Выдача Sanctum-токенов для нативных приложений.
 *
 * Web продолжает работать на cookie (web+auth) как раньше.
 * Этот контроллер используется только Capacitor-приложением:
 * логин по email+password -> Bearer-токен в Preferences.
 */
class MobileAuthController extends Controller
{
    /**
     * Выдать мобильный токен.
     *
     * @param Request $request
     * @return JsonResponse {token, user}
     * @throws ValidationException
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
            'device_name' => ['nullable', 'string', 'max:64'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        $passwordOk = $user !== null
            && Hash::check($validated['password'], $user->password);

        if (! $passwordOk || $user->isBanned()) {
            throw ValidationException::withMessages([
                'email' => ['Неверные данные для входа.'],
            ]);
        }

        $deviceName = $validated['device_name'] ?? 'mobile';

        $user->tokens()->where('name', $deviceName)->delete();

        $token = $user->createToken($deviceName, ['*'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }

    /**
     * Отозвать текущий мобильный токен (logout натива).
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function destroy(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();

        if ($token !== null) {
            $token->delete();
        }

        return response()->json(['ok' => true]);
    }
}
