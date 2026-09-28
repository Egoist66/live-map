<?php

namespace App\Services;

use Illuminate\Http\Request;

/**
 * Детектор нативного клиента (upin-mobile через WebView).
 *
 * Натив помечает себя явно — заголовком `X-UPin-Client`,
 * куку `upin_client=native`, query `?client=native` или
 * UA-суффиксом `UPinMobile/...` (legacy `UPinApp/...`). Общий `; wv)` в UA
 * намеренно НЕ считаем признаком: так помечаются и
 * кастомные вкладки браузеров.
 *
 * SSR отдаём всем обычным браузерам, включая приватные
 * app-роуты (карта, чаты, профиль): Inertia молча откатывается
 * в CSR при любой ошибке Node-рендера, поэтому «ускорение»
 * через принудительный bypass только прячет реальные краши
 * и ломает первую отрисовку. Bypass — только для нативной WebView,
 * где SEO-разметка не нужна и важен быстрый TTFB без хопа в Node :13714.
 */
class NativeClientDetector
{
    /**
     * Значение заголовка, которым мобилка представляется.
     *
     * @var string
     */
    public const HEADER = 'X-UPin-Client';

    /**
     * Паттерны приватных экранов без SEO-ценности.
     *
     * Оставлено для диагностики/метрик (isAppRoute), но НЕ используется
     * для отключения SSR: в обычном браузере SSR отдаём везде.
     *
     * @var array<int, string>
     */
    private const CSR_ONLY_PATTERNS = [
        'map*',
        'chat*',
        'flow*',
        'districts*',
        'settings*',
        'profile*',
        'dashboard*',
        'swipes*',
        'admin*',
    ];

    /**
     * Проверить, что запрос пришел из нативной WebView-оболочки.
     *
     * Telegram Mini App (@U1ove_bot) считаем нативом тоже:
     * SEO там бесполезно, а быстрый CSR без хопа в Node :13714
     * критичен внутри телеграма. Детект — через isTelegram().
     *
     * @param Request $request текущий запрос
     * @return bool true для upin-mobile / Telegram, иначе false
     */
    public function isNative(Request $request): bool
    {
        $headerName = $this->headerName($request);
        if ($headerName !== null) {
            return true;
        }

        if ($this->hasNativeCookie($request)) {
            return true;
        }

        if ($this->hasNativeQuery($request)) {
            return true;
        }

        if ($this->hasNativeUserAgent($request)) {
            return true;
        }

        return $this->isTelegram($request);
    }

    /**
     * Проверить, что запрос пришел из Telegram Mini App.
     *
     * Маркер ставит фронт (useTelegram): заголовок
     * `X-UPin-Client: telegram-webapp`, кука `upin_client=telegram`,
     * query `?client=telegram` или tgWebApp-параметры
     * (`tgWebAppPlatform`, `tgWebAppVersion`, `tgWebAppData`).
     * UA у телеграма обычный — по нему не детектим.
     *
     * @param Request $request текущий запрос
     * @return bool true внутри Telegram WebApp
     */
    public function isTelegram(Request $request): bool
    {
        $header = strtolower(trim((string) $request->header(self::HEADER, '')));

        if ($header !== '' && str_contains($header, 'telegram')) {
            return true;
        }

        $cookie = strtolower(trim((string) $request->cookie('upin_client', '')));

        if ($cookie === 'telegram' || $cookie === 'telegram-webapp') {
            return true;
        }

        $query = strtolower(trim((string) $request->query('client', '')));

        if ($query === 'telegram' || $query === 'telegram-webapp') {
            return true;
        }

        $hasTgQuery = $request->query('tgWebAppPlatform') !== null
            || $request->query('tgWebAppVersion') !== null
            || $request->query('tgWebAppData') !== null;

        if ($hasTgQuery) {
            return true;
        }

        return false;
    }

    /**
     * Человекочитаемое имя клиента для логов и шаринга в Inertia.
     *
     * @param Request $request текущий запрос
     * @return string|null android-webview/ios-webview/native/null
     */
    public function clientName(Request $request): ?string
    {
        $header = strtolower(trim((string) $request->header(self::HEADER, '')));
        if ($header !== '') {
            return $this->normalizeClientName($header);
        }

        if ($this->isTelegram($request)) {
            return 'telegram-webapp';
        }

        $userAgent = strtolower((string) $request->userAgent());
        if ($userAgent === '') {
            return null;
        }

        $isUpin = $this->hasNativeUserAgentToken($userAgent);

        if (! $isUpin) {
            return null;
        }

        return $this->normalizeClientName($userAgent);
    }

    /**
     * Решить, надо ли тушить SSR для этого запроса.
     *
     * SSR отдаём всем обычным браузерам. Тушим только нативную
     * WebView: там SEO бесполезно, а лишний хоп в Node :13714
     * замедляет первую загрузку в приложении.
     *
     * @param Request $request текущий запрос
     * @return bool true — отдать CSR без Node-рендера
     */
    public function shouldDisableSsr(Request $request): bool
    {
        return $this->isNative($request);
    }

    /**
     * Проверить, что путь относится к приватному приложению без SEO.
     *
     * @param Request $request текущий запрос
     * @return bool true для map/chat/settings и т.п.
     */
    public function isAppRoute(Request $request): bool
    {
        return $request->is(...self::CSR_ONLY_PATTERNS);
    }

    /**
     * Распознать явный заголовок клиента.
     *
     * @param Request $request текущий запрос
     * @return string|null имя клиента или null
     */
    private function headerName(Request $request): ?string
    {
        $header = strtolower(trim((string) $request->header(self::HEADER, '')));
        if ($header === '') {
            return null;
        }

        $isNativeHeader = str_contains($header, 'webview')
            || str_contains($header, 'upin-mobile')
            || str_contains($header, 'upinmobile')
            || str_contains($header, 'expo')
            || str_contains($header, 'telegram')
            || $header === 'native';

        if (! $isNativeHeader) {
            return null;
        }

        return $this->normalizeClientName($header);
    }

    /**
     * Проверить куку `upin_client=native`.
     *
     * @param Request $request текущий запрос
     * @return bool
     */
    private function hasNativeCookie(Request $request): bool
    {
        $cookie = strtolower(trim((string) $request->cookie('upin_client', '')));

        return $cookie === 'native' || $cookie === 'webview' || $cookie === 'telegram' || $cookie === 'telegram-webapp';
    }

    /**
     * Проверить query `?client=native`.
     *
     * @param Request $request текущий запрос
     * @return bool
     */
    private function hasNativeQuery(Request $request): bool
    {
        $query = strtolower(trim((string) $request->query('client', '')));

        return $query === 'native' || $query === 'webview' || $query === 'telegram' || $query === 'telegram-webapp';
    }

    /**
     * Проверить UA-суффикс мобилки: `UPinMobile/...`, `...-webview`, legacy `UPinApp/...`.
     *
     * Legacy-токен `upinapp` оставлен ради уже установленных сборок 1.0,
     * новые шлют `UPinMobile/<версия> <платформа>-webview` (см. NATIVE_USER_AGENT_SUFFIX).
     *
     * @param Request $request текущий запрос
     * @return bool
     */
    private function hasNativeUserAgent(Request $request): bool
    {
        $userAgent = strtolower((string) $request->userAgent());
        if ($userAgent === '') {
            return false;
        }

        return $this->hasNativeUserAgentToken($userAgent);
    }

    /**
     * Проверить строку UA на маркеры мобилки (уже в нижнем регистре).
     *
     * @param string $userAgent user-agent в нижнем регистре
     * @return bool
     */
    private function hasNativeUserAgentToken(string $userAgent): bool
    {
        return str_contains($userAgent, 'upinmobile')
            || str_contains($userAgent, 'upin-android')
            || str_contains($userAgent, 'upin-ios')
            || str_contains($userAgent, 'upinapp');
    }

    /**
     * Привести сырую строку к android-webview/ios-webview/native.
     *
     * @param string $raw заголовок или UA в нижнем регистре
     * @return string нормализованное имя клиента
     */
    private function normalizeClientName(string $raw): string
    {
        if (str_contains($raw, 'telegram')) {
            return 'telegram-webapp';
        }

        $isIos = str_contains($raw, 'ios');
        if ($isIos) {
            return 'ios-webview';
        }

        $isAndroid = str_contains($raw, 'android');
        if ($isAndroid) {
            return 'android-webview';
        }

        return 'native';
    }
}
