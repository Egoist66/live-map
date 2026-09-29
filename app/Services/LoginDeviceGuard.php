<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserDevice;
use App\Notifications\SecurityNewDeviceNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Охрана входов с новых устройств.
 *
 * Вызывается после каждого успешного входа (пароль, Telegram,
 * регистрация): сверяет отпечаток устройства с известными.
 * Первое устройство пользователя и уже известные — тихо,
 * неизвестное — алерт тремя каналами: колокольчик + web-push
 * (через UserNotifier) и дубль в Telegram-личку бота.
 *
 * Метод никогда не кидает исключений: алерт — необязательный
 * сайд-эффект входа и не должен ронять авторизацию.
 */
class LoginDeviceGuard
{
    /**
     * Кулдаун дублей алерта на связку юзер + отпечаток, секунд.
     */
    public const ALERT_COOLDOWN_SECONDS = 86400;

    /**
     * Обработать успешный вход: запомнить устройство, при новом — насторожить.
     *
     * @param User $user вошедший пользователь
     * @param Request $request запрос входа (IP, UA, клиент)
     * @param string $via канал входа: password|telegram|register
     * @return void
     */
    public static function handleLogin(User $user, Request $request, string $via = 'password'): void
    {
        try {
            $fp = DeviceFingerprint::fromRequest($request);
            $sessionId = (string) $request->session()->getId();

            $known = UserDevice::where('user_id', $user->id)
                ->where('fingerprint', $fp['fingerprint'])
                ->first();

            if ($known) {
                $known->forceFill([
                    'ip' => $fp['ip'],
                    'user_agent' => $fp['user_agent'],
                    'country' => $fp['country'],
                    'country_code' => $fp['country_code'],
                    'city' => $fp['city'],
                    'session_id' => $sessionId !== '' ? $sessionId : $known->session_id,
                    'last_seen_at' => now(),
                ])->saveQuietly();

                return;
            }

            $isFirst = ! UserDevice::where('user_id', $user->id)->exists();

            $device = UserDevice::create([
                'user_id' => $user->id,
                'fingerprint' => $fp['fingerprint'],
                'ip' => $fp['ip'],
                'user_agent' => $fp['user_agent'],
                'device' => $fp['device'],
                'platform' => $fp['platform'],
                'browser' => $fp['browser'],
                'client' => $fp['client'],
                'trusted' => $isFirst,
                'blocked' => false,
                'session_id' => $sessionId !== '' ? $sessionId : null,
                'country' => $fp['country'],
                'country_code' => $fp['country_code'],
                'city' => $fp['city'],
                'first_seen_at' => now(),
                'last_seen_at' => now(),
            ]);

            if ($isFirst) {
                return;
            }

            $cooldownKey = 'sec:new-device:'.$user->id.':'.$fp['fingerprint'];

            if (Cache::has($cooldownKey)) {
                return;
            }

            Cache::put($cooldownKey, true, self::ALERT_COOLDOWN_SECONDS);

            self::alert($user, $device, $via);
        } catch (\Throwable $e) {
            Log::warning('login device guard failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Разослать алерт о новом устройстве: inbox + Telegram-дубль.
     *
     * @param User $user владелец аккаунта
     * @param UserDevice $device новое устройство
     * @param string $via канал входа
     * @return void
     */
    private static function alert(User $user, UserDevice $device, string $via): void
    {
        try {
            UserNotifier::send($user, new SecurityNewDeviceNotification($device));
        } catch (\Throwable $e) {
            Log::warning('new device inbox failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
        }

        try {
            $fresh = $user->fresh();

            if ($fresh && (int) ($fresh->telegram_id ?? 0) > 0 && $fresh->telegram_blocked_at === null) {
                // Кнопка ведёт прямо на таб «Безопасность» к карточке сеансов:
                // голый /settings открывает таб «Профиль», sessions не видно.
                TelegramNotifier::send($fresh, self::telegramText($device, $via), '/settings/security#sessions', 'Мои сеансы');
            }
        } catch (\Throwable $e) {
            Log::warning('new device telegram failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Текст Telegram-дубля: кто, откуда, с чего, что делать.
     *
     * @param UserDevice $device новое устройство
     * @param string $via канал входа
     * @return string текст в HTML-разметке Telegram
     */
    private static function telegramText(UserDevice $device, string $via): string
    {
        $esc = fn (?string $v): string => htmlspecialchars(trim((string) $v), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        $lines = ['🔐 <b>Вход с нового устройства</b>', $esc($device->label())];

        $place = trim(implode(', ', array_filter([$device->city, $device->country])));

        if ($place !== '') {
            $lines[] = '📍 '.$esc($place);
        }

        if (trim((string) $device->ip) !== '') {
            $lines[] = 'IP: <code>'.$esc($device->ip).'</code>';
        }

        $viaLabel = match ($via) {
            'telegram' => 'через Telegram',
            'register' => 'регистрация',
            default => 'по паролю',
        };

        $lines[] = 'Вход '.$esc($viaLabel).'.';
        $lines[] = 'Если это были не вы — завершите сеанс: Настройки → Безопасность → Сеансы.';

        return implode("\n", $lines);
    }
}
