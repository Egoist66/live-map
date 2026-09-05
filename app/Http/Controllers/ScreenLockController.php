<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ScreenLockController extends Controller
{
    public function show(Request $request)
    {
        $u = $request->user();

        return response()->json([
            'enabled' => $u->screen_lock_code !== null,
            'timeout' => (int) ($u->screen_lock_timeout ?? 5),
            'kind' => $u->screen_lock_kind === 'alpha8' ? 'alpha8' : 'pin4',
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'kind' => ['required', 'string', 'in:pin4,alpha8'],
            'code' => ['required', 'string', function ($attr, $val, $fail) use ($request) {
                $kind = $request->input('kind');
                $ok = $kind === 'alpha8'
                    ? (bool) preg_match('/^[A-Za-z0-9]{8}$/', (string) $val)
                    : (bool) preg_match('/^\d{4}$/', (string) $val);
                if (!$ok) {
                    $fail($kind === 'alpha8' ? 'Пароль — ровно 8 символов: латиница и цифры.' : 'PIN — ровно 4 цифры.');
                }
            }],
            'timeout' => ['required', 'integer', 'in:1,5,10'],
        ]);
        $request->user()->forceFill([
            'screen_lock_code' => $data['code'],
            'screen_lock_timeout' => (int) $data['timeout'],
            'screen_lock_kind' => $data['kind'],
        ])->save();

        return response()->json(['enabled' => true, 'timeout' => (int) $data['timeout'], 'kind' => $data['kind']]);
    }

    public function destroy(Request $request)
    {
        $request->user()->forceFill(['screen_lock_code' => null])->save();

        return response()->json(['enabled' => false]);
    }

    public function verify(Request $request)
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:32']]);
        $stored = (string) ($request->user()->screen_lock_code ?? '');
        abort_if($stored === '', 404, 'Код не установлен');
        abort_unless(hash_equals($stored, (string) $data['code']), 422, 'Неверный код');

        return response()->json(['ok' => true]);
    }
}
