<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * Отпечаток устройства по запросу: платформа + браузер + клиент.
 *
 * Версии браузеров и IP в отпечаток НЕ входят — они меняются сами
 * (автообновление, мобильные сети) и плодили бы ложные алерты.
 * IP и гео храним отдельно для подписи «откуда зашли».
 *
 * Клиент различаем маркерами фронта: заголовок X-UPin-Client,
 * кука upin_client, query client (см. useTelegram/useNativeClient).
 */
class DeviceFingerprint
{
    /**
     * Собрать отпечаток и подпись устройства из запроса.
     *
     * @param Request $request текущий запрос
     * @return array{fingerprint:string,ip:string|null,user_agent:string|null,device:string,platform:string,browser:string,client:string,country:string|null,country_code:string|null,city:string|null}
     */
    public static function fromRequest(Request $request): array
    {
        $ua = (string) ($request->userAgent() ?? '');
        $parsed = self::parseUserAgent($ua);
        $client = self::client($request);
        $ip = $request->ip();
        $geo = IpGeolocation::lookup($ip);

        $fingerprint = hash('sha256', implode('|', [
            mb_strtolower($parsed['platform']),
            mb_strtolower($parsed['browser']),
            mb_strtolower($parsed['device']),
            mb_strtolower($client),
        ]));

        return [
            'fingerprint' => $fingerprint,
            'ip' => $ip,
            'user_agent' => $ua !== '' ? mb_substr($ua, 0, 512) : null,
            'device' => $parsed['device'],
            'platform' => $parsed['platform'],
            'browser' => $parsed['browser'],
            'client' => $client,
            'country' => $geo['country'],
            'country_code' => $geo['country_code'],
            'city' => $geo['city'],
        ];
    }

    /**
     * Лёгкий отпечаток без гео (без HTTP): для per-request проверок.
     *
     * @param Request $request текущий запрос
     * @return array{fingerprint:string,device:string,platform:string,browser:string,client:string}
     */
    public static function fingerprintOnly(Request $request): array
    {
        $ua = (string) ($request->userAgent() ?? '');
        $parsed = self::parseUserAgent($ua);
        $client = self::client($request);

        $fingerprint = hash('sha256', implode('|', [
            mb_strtolower($parsed['platform']),
            mb_strtolower($parsed['browser']),
            mb_strtolower($parsed['device']),
            mb_strtolower($client),
        ]));

        return [
            'fingerprint' => $fingerprint,
            'device' => $parsed['device'],
            'platform' => $parsed['platform'],
            'browser' => $parsed['browser'],
            'client' => $client,
        ];
    }

    /**
     * Человеческая подпись отпечатка для алертов.
     *
     * @param array{platform:string,browser:string,client:string} $fp отпечаток из fromRequest
     * @return string вроде «Chrome · Windows» или «Telegram · iPhone»
     */
    public static function label(array $fp): string
    {
        $browser = trim((string) ($fp['browser'] ?? ''));
        $platform = trim((string) ($fp['platform'] ?? ''));

        if (($fp['client'] ?? 'web') === 'telegram') {
            return $platform !== '' ? 'Telegram · '.$platform : 'Telegram';
        }

        if ($browser !== '' && $platform !== '') {
            return $browser.' · '.$platform;
        }

        return $browser !== '' ? $browser : ($platform !== '' ? $platform : 'Неизвестное устройство');
    }

    /**
     * Разобрать User-Agent в тройку платформа/браузер/класс.
     *
     * Порядок важен: Яндекс и Опера маскируются под Chrome,
     * Edge — тоже, CriOS/FxiOS — мобильные сборки под iOS.
     *
     * @param string $ua сырой User-Agent
     * @return array{platform:string,browser:string,device:string}
     */
    public static function parseUserAgent(string $ua): array
    {
        $isMobile = (bool) preg_match('/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i', $ua);
        $isTablet = (bool) preg_match('/iPad|Tablet|PlayBook|Silk/i', $ua)
            || (stripos($ua, 'Android') !== false && ! $isMobile);

        $device = 'desktop';

        if ($isTablet) {
            $device = 'tablet';
        } elseif ($isMobile) {
            $device = 'phone';
        }

        $platform = 'Unknown';

        if (preg_match('/Windows NT/i', $ua)) {
            $platform = 'Windows';
        } elseif (preg_match('/iPhone|iPad|iPod/i', $ua)) {
            $platform = stripos($ua, 'iPad') !== false ? 'iPad' : 'iPhone';
        } elseif (stripos($ua, 'Android') !== false) {
            $platform = 'Android';
        } elseif (preg_match('/Mac OS X|Macintosh/i', $ua)) {
            $platform = 'macOS';
        } elseif (stripos($ua, 'Linux') !== false) {
            $platform = 'Linux';
        }

        $browser = 'Browser';

        if (preg_match('/YaBrowser/i', $ua)) {
            $browser = 'Yandex';
        } elseif (preg_match('/SamsungBrowser/i', $ua)) {
            $browser = 'Samsung';
        } elseif (preg_match('/OPR\/|Opera/i', $ua)) {
            $browser = 'Opera';
        } elseif (preg_match('/Edg\/|Edge\//i', $ua)) {
            $browser = 'Edge';
        } elseif (preg_match('/CriOS|Chrome\//i', $ua)) {
            $browser = 'Chrome';
        } elseif (preg_match('/FxiOS|Firefox\//i', $ua)) {
            $browser = 'Firefox';
        } elseif (preg_match('/Safari\//i', $ua)) {
            $browser = 'Safari';
        }

        return ['platform' => $platform, 'browser' => $browser, 'device' => $device];
    }

    /**
     * Определить клиент приложения: web, telegram или native.
     *
     * @param Request $request текущий запрос
     * @return string web|telegram|native
     */
    public static function client(Request $request): string
    {
        $header = mb_strtolower((string) $request->header('X-UPin-Client', ''));

        if (str_contains($header, 'telegram')) {
            return 'telegram';
        }

        if ($header !== '' && $header !== 'web') {
            return 'native';
        }

        $cookie = mb_strtolower((string) $request->cookie('upin_client', ''));

        if (str_contains($cookie, 'telegram')) {
            return 'telegram';
        }

        if ($cookie === 'native' || $cookie === 'webview') {
            return 'native';
        }

        $query = mb_strtolower((string) $request->query('client', ''));

        if (str_contains($query, 'telegram')) {
            return 'telegram';
        }

        if ($query === 'native' || $query === 'webview') {
            return 'native';
        }

        return 'web';
    }
}
