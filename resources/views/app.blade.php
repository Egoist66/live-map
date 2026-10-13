<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content, viewport-fit=cover">
        <meta name="color-scheme" content="light dark">
        <meta name="theme-color" content="{{ $seoHead['theme_color'] ?? config('seo.theme_color', '#0F172A') }}">
        {{-- Нативу (upin-mobile WebView) SEO-разметка не нужна: режем вес head и шлем noindex,
             чтобы ?client=native случайно не попал в индекс. --}}
        @php($isNativeClient = $isNative ?? false)
        @php($isTelegramClient = $isTelegram ?? false)
        @php($seoRobots = $seoHead['robots'] ?? config('seo.robots'))
        <meta name="robots" content="{{ $isNativeClient ? 'noindex, nofollow' : $seoRobots }}">
        <meta name="author" content="{{ $seoHead['author'] ?? config('seo.author') }}">
        @if(!$isNativeClient)
        <meta name="description" content="{{ $seoHead['description'] ?? config('seo.default_description') }}">
        <meta name="keywords" content="{{ $seoHead['keywords'] ?? implode(', ', config('seo.keywords', [])) }}">
        @php($seoInt = $seoIntegrations ?? [])
        @if(!empty($seoInt['google_site_verification']))
        <meta name="google-site-verification" content="{{ $seoInt['google_site_verification'] }}">
        @endif
        @if(!empty($seoInt['yandex_verification']))
        <meta name="yandex-verification" content="{{ $seoInt['yandex_verification'] }}">
        @endif
        @if(!empty($seoInt['bing_verification']))
        <meta name="msvalidate.01" content="{{ $seoInt['bing_verification'] }}">
        @endif
        @endif
        <meta name="format-detection" content="telephone=no">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="vapid-public-key" content="{{ config('services.webpush.vapid.public_key') }}">
        @if(!$isNativeClient)
        <link rel="canonical" href="{{ $seoHead['canonical'] ?? url()->current() }}">
        @endif

        <link rel="manifest" href="/manifest.webmanifest">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="application-name" content="{{ $seoHead['site_name'] ?? config('seo.site_name') }}">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="{{ $seoHead['site_name'] ?? config('seo.site_name') }}">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="msapplication-TileColor" content="#FD267D">
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#150B10">

        <meta property="og:site_name" content="{{ $seoHead['site_name'] ?? config('seo.site_name') }}">
        @if(!$isNativeClient)
        <meta property="og:type" content="{{ $seoHead['og_type'] ?? config('seo.og_type', 'website') }}">
        <meta property="og:locale" content="{{ $seoHead['locale'] ?? config('seo.locale', 'ru_RU') }}">
        <meta property="og:url" content="{{ $seoHead['canonical'] ?? url()->current() }}">
        <meta property="og:title" content="{{ $seoHead['og_title'] ?? $seoHead['title'] ?? config('seo.default_title') }}">
        <meta property="og:description" content="{{ $seoHead['og_description'] ?? $seoHead['description'] ?? config('seo.default_description') }}">
        <meta property="og:image" content="{{ url($seoHead['og_image'] ?? config('seo.image', '/og-cover.jpg')) }}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">

        <meta name="twitter:card" content="{{ $seoHead['twitter_card'] ?? config('seo.twitter_card', 'summary_large_image') }}">
        <meta name="twitter:title" content="{{ $seoHead['og_title'] ?? $seoHead['title'] ?? config('seo.default_title') }}">
        <meta name="twitter:description" content="{{ $seoHead['og_description'] ?? $seoHead['description'] ?? config('seo.default_description') }}">
        <meta name="twitter:image" content="{{ url($seoHead['og_image'] ?? config('seo.image', '/og-cover.jpg')) }}">
        @if(!empty($seoHead['twitter_site']))
            <meta name="twitter:site" content="{{ $seoHead['twitter_site'] }}">
        @endif
        @endif
        <title inertia>{{ $seoHead['title'] ?? config('seo.default_title') }}</title>
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/pwa-icon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        {{-- `crossorigin` обязателен для preconnect шрифтов, иначе браузер
              открывает второе соединение (предупреждение Lighthouse
              `network-dependency-tree-insight`). Прелоад 700/800 — это
              жирные заголовки/футер: именно их поздняя подмена давала
              CLS 0.24 (`cls-culprits-insight`). CSS оставлен синхронным
              сознательно: async-вариант (`media=print` + `onload`) режется
              нашим CSP (`script-src` без `unsafe-inline` блочит инлайн-
              хендлеры) и усиливал бы CLS поздним свопом. --}}
        <link rel="preconnect" href="https://fonts.bunny.net" crossorigin>
        <link rel="preload" as="font" type="font/woff2" crossorigin href="https://fonts.bunny.net/figtree/files/figtree-latin-700-normal.woff2">
        <link rel="preload" as="font" type="font/woff2" crossorigin href="https://fonts.bunny.net/figtree/files/figtree-latin-800-normal.woff2">
        {{-- Figtree без 900: font-black синтезируется из 800 без видимой разницы,
              зато минус один woff2 на первом визите. Inter — только используемые веса. --}}
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600,700,800&family=inter:400,500,600&display=swap" rel="stylesheet">
        {{-- Telegram Mini App (@U1ove_bot): WebApp API нужен ДО первого paint
              (ранний инлайн ниже сразу делает ready(), иначе Mini App моргает
              схлопнутым BottomSheet, пока Vue-мост догрузится после mount;
              expand — только на мобиле, иначе десктопный клиент уводит
              WebView в немасштабируемое окно справа).
              Сервер уже опознал Telegram ($isTelegram: кука/query/header
              с прошлого визита) — грузим синхронно, как раньше. Всем остальным
              (браузеры, upin-mobile, PWA — 95%+ трафика) — `defer`: парсер
              не блокируется, а ready/expand/тема догоняют `load`-слушателем
              ниже (функция `__upinTgEarlyInit` вызывается дважды: при парсе
              и по загрузке библиотеки, идемпотентно). Полноценный мост (тема,
              viewport-подписки, автовход) живёт во фронте:
              useTelegram / useTelegramAuth (Правило №1). --}}
        @if($isTelegramClient)
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        @else
        <script id="tg-webapp-js" defer src="https://telegram.org/js/telegram-web-app.js"></script>
        @endif
        <script nonce="{{ $cspNonce ?? '' }}">
            window.__upinTgEarlyInit = function () {
                try {
                    var haystack = (window.location.search + ' ' + window.location.hash).toLowerCase();
                    var looksLikeTg = haystack.indexOf('tgwebappplatform') !== -1
                        || haystack.indexOf('tgwebappdata') !== -1
                        || haystack.indexOf('tgwebappversion') !== -1;
                    var webApp = (window.Telegram && window.Telegram.WebApp) || null;
                    // telegram-web-app.js определяет window.Telegram.WebApp ВСЕГДА,
                    // даже в обычном десктопном Chrome (initData пуст, platform unknown).
                    // Реальный Mini App доказывается только непустым initData или
                    // tgWebApp-маркерами в URL. Без них это десктоп/PWA: SSR обязан
                    // работать, поэтому куку не ставим, а отравленную (годовую,
                    // от прежней версии скрипта) — чистим для самовосстановления.
                    var hasInitData = !!(webApp && webApp.initData && String(webApp.initData).length > 0);
                    var isRealTg = hasInitData || looksLikeTg;
                    if (!isRealTg) {
                        try {
                            if (/(?:^|;\s*)upin_client=telegram(-webapp)?(?:;|$)/.test(document.cookie)) {
                                document.cookie = 'upin_client=; path=/; max-age=0; SameSite=Lax';
                            }
                        } catch (e) {}
                        return;
                    }
                    // Маркер для бэка (DetectNativeClient): кука читается уже
                    // на document-запросах, hash до сервера не долетает.
                    try { document.cookie = 'upin_client=telegram; path=/; max-age=31536000; SameSite=Lax'; } catch (e) {}
                    if (!webApp || typeof webApp.ready !== 'function') return;
                    var root = document.documentElement;
                    root.classList.add('tg-app');
                    try { webApp.ready(); } catch (e) {}
                    // Десктопный Mini App (боковая панель Windows/macOS):
                    // expand здесь уводит WebView в немасштабируемое окно
                    // справа («не двигается, не закрыть») — только ready.
                    // Единый предикат с useTelegram.isDesktopTelegramPlatform:
                    // мобильная ОС без тача = десктоп (эмулятор с мышью),
                    // unknown/пустая платформа или web-клиент = десктоп,
                    // кроме узкого тач-экрана (телефон в браузере).
                    var __tgPlatEarly = '';
                    try { __tgPlatEarly = String(webApp.platform || '').toLowerCase(); } catch (e5) {}
                    var __tgMobileOsEarly = __tgPlatEarly.indexOf('android') === 0 || __tgPlatEarly.indexOf('ios') === 0;
                    var __tgCoarseEarly = false;
                    try { __tgCoarseEarly = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e6) {}
                    var __tgNarrowEarly = false;
                    try { __tgNarrowEarly = window.innerWidth < 768; } catch (e7) {}
                    var __tgIsDesktopEarly = __tgMobileOsEarly
                        ? !__tgCoarseEarly
                        : !(__tgCoarseEarly && __tgNarrowEarly);
                    if (!__tgIsDesktopEarly) {
                        try { webApp.expand(); } catch (e) {}
                    }
                    // disableVerticalSwipes — Bot API 7.1: на старых клиентах
                    // (6.0) прямой вызов лишь спамит варнингом в консоль,
                    // поэтому версию проверяем заранее (isVersionAtLeast
                    // есть с 6.2, на 6.0 сравниваем version вручную).
                    // На десктопе вертикальных свайпов нет — не трогаем.
                    try {
                        var supportsSwipes = false;
                        if (typeof webApp.isVersionAtLeast === 'function') {
                            supportsSwipes = webApp.isVersionAtLeast('7.1');
                        } else {
                            var parts = String(webApp.version || '').split('.');
                            var maj = parseInt(parts[0], 10) || 0;
                            var min = parseInt(parts[1], 10) || 0;
                            supportsSwipes = maj > 7 || (maj === 7 && min >= 1);
                        }
                        if (!__tgIsDesktopEarly && supportsSwipes && typeof webApp.disableVerticalSwipes === 'function') webApp.disableVerticalSwipes();
                    } catch (e) {}
                    // Тема Telegram → CSS-переменные до paint, чтобы не было
                    // белой вспышки в тёмной теме (мост useTelegram обновит их
                    // же при themeChanged и подпишется на события).
                    try {
                        var tp = webApp.themeParams || {};
                        var setVar = function (name, value) { if (value) root.style.setProperty(name, value); };
                        setVar('--tg-theme-bg-color', tp.bg_color);
                        setVar('--tg-theme-text-color', tp.text_color);
                        setVar('--tg-theme-hint-color', tp.hint_color);
                        setVar('--tg-theme-link-color', tp.link_color);
                        setVar('--tg-theme-button-color', tp.button_color);
                        setVar('--tg-theme-button-text-color', tp.button_text_color);
                        setVar('--tg-theme-secondary-bg-color', tp.secondary_bg_color);
                        setVar('--tg-theme-header-bg-color', tp.header_bg_color);
                        setVar('--tg-theme-accent-text-color', tp.accent_text_color);
                        setVar('--tg-theme-section-bg-color', tp.section_bg_color);
                        var scheme = webApp.colorScheme === 'dark' ? 'dark' : 'light';
                        root.classList.toggle('tg-dark', scheme === 'dark');
                        var vh = webApp.viewportHeight || window.innerHeight;
                        root.style.setProperty('--tg-viewport-height', vh + 'px');
                        var stable = webApp.viewportStableHeight || vh;
                        root.style.setProperty('--tg-viewport-stable', stable + 'px');
                        var inset = webApp.contentSafeAreaInset || webApp.safeAreaInset || null;
                        var rawTop = Math.max(0, Math.round((inset && inset.top) || 0));
                        var rawBottom = Math.max(0, Math.round((inset && inset.bottom) || 0));
                        // Зазор под нативные кнопки клиента (закрыть слева,
                        // свернуть/меню справа): они парят поверх WebView.
                        // Старые клиенты (WebApp 6.0) инсетов не отдают вовсе —
                        // резервируем минимум 48px, новые с честным
                        // contentSafeAreaInset получают 0. Только узкий тач
                        // (телефон): в десктопном клиенте кнопок поверх нет, а инсеты
                        // десктопного клиента раздували бы шапку (.native-safe-top),
                        // поэтому на десктопе инсеты принудительно нули
                        // + класс tg-desktop (CSS обнуляет паддинг шапки,
                        // мобилка tg-mobile отступы сохраняет).
                        // Тот же предикат, что для expand выше (без дубля эвристик).
                        var isDesktopTg = (typeof __tgIsDesktopEarly === 'boolean') ? __tgIsDesktopEarly : true;
                        var top = isDesktopTg ? 0 : rawTop;
                        var bottom = isDesktopTg ? 0 : rawBottom;
                        root.style.setProperty('--tg-sat', top + 'px');
                        root.style.setProperty('--tg-sab', bottom + 'px');
                        root.classList.toggle('tg-desktop', isDesktopTg);
                        root.classList.toggle('tg-mobile', !isDesktopTg);
                        try { root.dataset.tgPlatform = webApp.platform || ''; } catch (e4) {}
                        var topSafe = (typeof top === 'number' && isFinite(top)) ? top : 0;
                        var chromeTop = (!isDesktopTg) ? Math.max(0, 48 - topSafe) : 0;
                        root.style.setProperty('--tg-chrome-top', chromeTop + 'px');
                    } catch (e) {}
                } catch (e) {}
            };
            try { window.__upinTgEarlyInit(); } catch (e) {}
            // Догон для defer-загрузки (не-TG ветка тега выше): при парсе
            // библиотеки ещё нет и init вышел раньше времени — повторяем
            // по `load` скрипта. Инлайн-`onload` в разметке запрещён нашим
            // CSP (script-src без unsafe-inline), поэтому слушатель вешаем
            // отсюда (nonce-скрипт). В sync-ветке элемента #tg-webapp-js нет —
            // тихо пропускаем. Повтор идемпотентен: ready/expand/кука/классы
            // выставляются теми же значениями.
            try {
                var tgScript = document.getElementById('tg-webapp-js');
                if (tgScript && !tgScript.dataset.tgBound) {
                    tgScript.dataset.tgBound = '1';
                    tgScript.addEventListener('load', function () {
                        try { window.__upinTgEarlyInit(); } catch (err) {}
                    });
                }
            } catch (e) {}
        </script>
        <script nonce="{{ $cspNonce ?? '' }}">
            (function(){ try{ var root=document.documentElement; var s=localStorage.getItem('theme'); var m=window.matchMedia('(prefers-color-scheme: dark)').matches; var isTg=root.classList.contains('tg-app'); var tgDark=root.classList.contains('tg-dark'); var d=isTg ? tgDark : (s ? s==='dark' : m); if(d) root.classList.add('dark'); else root.classList.remove('dark'); root.style.colorScheme = d?'dark':'light'; var tgBg=root.classList.contains('tg-app') ? root.style.getPropertyValue('--tg-theme-bg-color').trim() : ''; var bg=tgBg || (d?'#0F121F':'#ffffff'); window.__upinThemeBg = bg; /* Держим тёмный фон, пока жив #pwa-boot: проверка getElementById здесь бессмысленна (head парсится раньше body-разметки, узел ещё не существует), а светлый <html> под фейдом выцветает розовый логотип в серый. Целевой фон вернёт __upinHideSplash ровно в момент удаления узла. */ root.style.backgroundColor = '#150B10'; }catch(e){} })();
        </script>
        {{-- Сторож загрузки entry: после деплоя HTML может ссылаться на уже
              удалённый `/build/assets/app-*.js` (протухший SW/HTTP-кэш, гонка
              rolling-деплоя) — тогда модуль не грузится вообще и страница
              навсегда остаётся белой (`#pwa-boot` гаснет по таймеру, `#app`
              пуст). app.ts ставит `__upinBooted = true` сразу после mount;
              если флага нет — лечимся сами: пара перезагрузок (вторая с
              `?v=` мимо кэшей), затем фолбэк-панель с кнопкой «Обновить»
              (чистка SW-кэшей + жёсткий переход). Счётчик общий с
              `useBootRecovery`/`usePageResolver` (`upin:boot-reloads`):
              максимум 2 самоперезагрузки за 5 минут — петель нет. --}}
        <script nonce="{{ $cspNonce ?? '' }}">
            (function () {
                try {
                    window.__upinBooted = false;
                    var KEY = 'upin:boot-reloads';
                    var MAX = 2;
                    var WINDOW_MS = 5 * 60 * 1000;
                    var BOOT_WAIT_MS = 9000;

                    var readGuard = function () {
                        try {
                            var raw = window.sessionStorage.getItem(KEY);
                            if (!raw) return { count: 0, firstAt: 0 };
                            var parsed = JSON.parse(raw);
                            return { count: Number(parsed.count) || 0, firstAt: Number(parsed.firstAt) || 0 };
                        } catch (e) { return { count: 0, firstAt: 0 }; }
                    };

                    var bustUrl = function () {
                        try {
                            var url = new URL(window.location.href);
                            url.searchParams.set('v', String(Date.now()));
                            return url.toString();
                        } catch (e) { return window.location.href; }
                    };

                    var heal = function () {
                        if (window.__upinBooted) return;
                        var now = Date.now();
                        var guard = readGuard();
                        var fresh = guard.firstAt && now - guard.firstAt < WINDOW_MS;
                        var count = fresh ? guard.count : 0;
                        if (count >= MAX) {
                            showFallback();
                            return;
                        }
                        try {
                            window.sessionStorage.setItem(KEY, JSON.stringify({ count: count + 1, firstAt: fresh ? guard.firstAt : now }));
                        } catch (e) {}
                        if (count === 0) {
                            window.location.reload();
                        } else {
                            window.location.replace(bustUrl());
                        }
                    };

                    var showFallback = function () {
                        try {
                            if (window.__upinBooted || document.getElementById('upin-boot-fallback')) return;
                            var box = document.createElement('div');
                            box.id = 'upin-boot-fallback';
                            box.setAttribute('role', 'alert');
                            var title = document.createElement('div');
                            title.className = 'upin-boot-fallback-title';
                            title.textContent = 'Не удалось загрузить приложение';
                            var text = document.createElement('p');
                            text.className = 'upin-boot-fallback-text';
                            text.textContent = 'Похоже, вышла новая версия, а страница осталась старой. Обновим — это быстро.';
                            var btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = 'upin-boot-fallback-btn';
                            btn.textContent = 'Обновить';
                            btn.addEventListener('click', function () {
                                try {
                                    if ('caches' in window) {
                                        window.caches.keys().then(function (keys) {
                                            keys.forEach(function (k) { window.caches.delete(k); });
                                        }).catch(function () {});
                                    }
                                } catch (e) {}
                                try {
                                    if (navigator.serviceWorker) {
                                        navigator.serviceWorker.getRegistrations().then(function (regs) {
                                            regs.forEach(function (r) { try { r.unregister(); } catch (e2) {} });
                                        }).catch(function () {});
                                    }
                                } catch (e) {}
                                window.setTimeout(function () { window.location.replace(bustUrl()); }, 350);
                            });
                            box.appendChild(title);
                            box.appendChild(text);
                            box.appendChild(btn);
                            document.body.appendChild(box);
                        } catch (e) {}
                    };

                    window.addEventListener('error', function (e) {
                        try {
                            var t = e && e.target;
                            var src = (t && (t.src || t.href)) || '';
                            if (typeof src === 'string' && src.indexOf('/build/assets/') !== -1) heal();
                        } catch (err) {}
                    }, true);

                    var armed = false;
                    var arm = function (ms) {
                        window.setTimeout(function () {
                            try { if (!window.__upinBooted) heal(); } catch (e) {}
                        }, ms);
                    };
                    window.addEventListener('load', function () {
                        if (!armed) { armed = true; arm(BOOT_WAIT_MS); }
                    });
                    arm(BOOT_WAIT_MS + 12000);
                    // Возврат «назад» может достать из bfcache мёртвый слепок
                    // (entry когда-то упал с 404): скрипты при этом не
                    // переисполняются и таймеры выше не срабатывают — страница
                    // остаётся белой навсегда. Живой слепок (флаг взведён
                    // app.ts после mount) не трогаем.
                    window.addEventListener('pageshow', function (e) {
                        try {
                            if (e && e.persisted && !window.__upinBooted) heal();
                        } catch (err) {}
                    });
                } catch (e) {}
            })();
        </script>
        {{-- Прелоадер: полноэкранный boot-экран в стиле Tinder
              (тёплая тьма, светящаяся иконка пин+сердце).
              Верхней линейной полосы здесь нет сознательно: при переходах
              по страницам её рисует Inertia-progress, а на полной
              перезагрузке достаточно сплэша.
              Системный сплэш PWA (иконка + UPin из манифеста) рисует сам
              Chrome — цвета манифеста подобраны под этот же фон, чтобы
              переход «системный сплэш → boot → приложение» был бесшовным. --}}
        <style nonce="{{ $cspNonce ?? '' }}">
          #pwa-boot {
            position: fixed;
            inset: 0;
            z-index: 9997;
            display: grid;
            place-items: center;
            /* Фон = background_color манифеста (#150B10): системный сплэш
               ОС (тёмный фон + квадратная иконка) бесшовно переходит в наш
               boot-экран — второго «появления» не видно. Поэтому здесь нет
               entrance-анимации: карточка рисуется сразу статично. */
            background:
              radial-gradient(90% 60% at 50% 0%, rgba(253, 38, 125, .12) 0%, rgba(253, 38, 125, 0) 60%),
              radial-gradient(70% 50% at 85% 100%, rgba(255, 120, 84, .08) 0%, rgba(255, 120, 84, 0) 60%),
              #150B10;
            transition: opacity .35s ease, visibility .35s ease;
          }
          #pwa-boot.done {
            opacity: 0;
            visibility: hidden;
          }
          #pwa-boot .boot-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 24px;
          }
          #pwa-boot .boot-icon {
            display: block;
            width: 96px;
            height: 96px;
            border-radius: 30px;
            /* TG WebView (WKWebView/Android) не клипает содержимое <svg>
               по border-radius: внутренний <rect> вылезает острыми углами.
               clip-path режет гарантированно, overflow — для остальных,
               градиент-подложка — чтобы скруглённая форма была видна даже
               до отрисовки SVG-градиентов. Иконка статична сознательно:
               бесконечный float на SVG с градиентами даёт repaint-flicker
               (моргание/серые кадры) в урезанном GPU Mini App. */
            overflow: hidden;
            -webkit-clip-path: inset(0 round 30px);
            clip-path: inset(0 round 30px);
            background: linear-gradient(135deg, #FD267D 0%, #E936C7 55%, #FF7854 100%);
            box-shadow: 0 18px 60px -12px rgba(253, 38, 125, .75), 0 0 0 1px rgba(255, 255, 255, .08);
          }
          #pwa-boot .boot-name {
            margin-top: 18px;
            color: #fff;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            font-size: 30px;
            font-weight: 800;
            letter-spacing: -0.03em;
          }
          #pwa-boot .boot-name span {
            font-weight: 300;
            opacity: .75;
          }
          #pwa-boot .boot-tag {
            margin-top: 6px;
            color: rgba(255, 255, 255, .6);
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            font-weight: 500;
            letter-spacing: .02em;
          }
          #pwa-boot .boot-bar {
            margin-top: 26px;
            width: 148px;
            height: 4px;
            border-radius: 999px;
            overflow: hidden;
            background: rgba(255, 255, 255, .12);
          }
          #pwa-boot .boot-bar > span {
            display: block;
            height: 100%;
            width: 40%;
            border-radius: inherit;
            background: linear-gradient(90deg, #FD267D, #E936C7, #FF7854);
            box-shadow: 0 0 12px rgba(253, 38, 125, .9);
            will-change: transform;
            transform: translateZ(0);
            animation: boot-slide 1.1s ease-in-out infinite;
          }
          @keyframes boot-slide {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(280%); }
          }
          @media (prefers-reduced-motion: reduce) {
            #pwa-boot *, #pwa-boot *::before, #pwa-boot *::after {
              animation: none !important;
            }
          }
          /* Фолбэк сторожа загрузки (см. скрипт выше): рисуется только когда
             entry не загрузился и перезагрузки исчерпаны. Стили инлайном,
             т.к. CSS приложения к этому моменту может отсутствовать. */
          #upin-boot-fallback {
            position: fixed;
            inset: 0;
            z-index: 9998;
            display: grid;
            place-items: center;
            padding: 24px;
            background: #150B10;
            text-align: center;
          }
          #upin-boot-fallback .upin-boot-fallback-title {
            color: #fff;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.02em;
          }
          #upin-boot-fallback .upin-boot-fallback-text {
            margin: 10px auto 0;
            max-width: 320px;
            color: rgba(255, 255, 255, .65);
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.5;
          }
          #upin-boot-fallback .upin-boot-fallback-btn {
            margin-top: 22px;
            border: 0;
            border-radius: 999px;
            padding: 13px 34px;
            background: linear-gradient(90deg, #FD267D, #E936C7, #FF7854);
            color: #fff;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
          }
        </style>
        @if(!$isNativeClient)
        <script type="application/ld+json" nonce="{{ $cspNonce ?? '' }}">
        {
            "@@context": "https://schema.org",
            "@@type": "WebSite",
            "name": "{{ $seoHead['site_name'] ?? config('seo.site_name') }}",
            "url": "{{ config('app.url') }}",
            "description": "{{ $seoHead['description'] ?? config('seo.default_description') }}",
            "inLanguage": "ru-RU",
            "potentialAction": {
                "@@type": "SearchAction",
                "target": "{{ config('app.url') }}/map?q={search_term_string}",
                "query-input": "required name=search_term_string"
            }
        }
        </script>
        <script type="application/ld+json" nonce="{{ $cspNonce ?? '' }}">
        {
            "@@context": "https://schema.org",
            "@@type": "Organization",
            "name": "{{ $seoHead['site_name'] ?? config('seo.site_name') }}",
            "url": "{{ config('app.url') }}",
            "logo": "{{ url('/favicon.ico') }}"
        }
        </script>
        @endif
        {{-- ===== Динамические счётчики и скрипты из панели SEO (админка → SEO → Интеграции) ===== --}}
        @if(!$isNativeClient && !empty($seoInt['scripts_enabled']))
        @if(!empty($seoInt['google_tag_manager_id']))
        <script nonce="{{ $cspNonce ?? '' }}">(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','{{ $seoInt['google_tag_manager_id'] }}');</script>
        @endif
        @if(!empty($seoInt['google_analytics_id']))
        <script async src="https://www.googletagmanager.com/gtag/js?id={{ $seoInt['google_analytics_id'] }}"></script>
        <script nonce="{{ $cspNonce ?? '' }}">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','{{ $seoInt['google_analytics_id'] }}');</script>
        @endif
        @if(!empty($seoInt['yandex_metrica_id']))
        <script nonce="{{ $cspNonce ?? '' }}">(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym({{ $seoInt['yandex_metrica_id'] }},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});</script>
        <noscript><div><img src="https://mc.yandex.ru/watch/{{ $seoInt['yandex_metrica_id'] }}" style="position:absolute;left:-9999px;" alt=""></div></noscript>
        @endif
        @if(!empty($seoInt['facebook_pixel_id']))
        <script nonce="{{ $cspNonce ?? '' }}">!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','{{ $seoInt['facebook_pixel_id'] }}');fbq('track','PageView');</script>
        @endif
        @if(!empty($seoInt['head_scripts']))
        {!! $seoInt['head_scripts'] !!}
        @endif
        @endif
        {!! app(\Tighten\Ziggy\BladeRouteGenerator::class)->generate(nonce: $cspNonce ?? null) !!}
        @vite(['resources/js/app.ts'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-surface dark:bg-[#0F121F] text-ink-900 dark:text-zinc-100">
        @if(!$isNativeClient && !empty(($seoIntegrations ?? [])['scripts_enabled']) && !empty(($seoIntegrations ?? [])['body_start_scripts']))
        {!! ($seoIntegrations ?? [])['body_start_scripts'] !!}
        @endif
        <div id="pwa-boot" role="status" aria-label="UPin загружается">
          <div class="boot-card">
            <svg class="boot-icon" viewBox="0 0 512 512" aria-hidden="true">
              <defs>
                <linearGradient id="boot-bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#FD267D" />
                  <stop offset="0.55" stop-color="#E936C7" />
                  <stop offset="1" stop-color="#FF7854" />
                </linearGradient>
                <radialGradient id="boot-glow" cx="0.5" cy="0.35" r="0.8">
                  <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.35" />
                  <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0" />
                </radialGradient>
              </defs>
              <rect width="512" height="512" rx="150" fill="url(#boot-bg)" />
              <rect width="512" height="512" rx="150" fill="url(#boot-glow)" />
              <path d="M256 108c-70 0-122 52-122 120 0 92 112 176 112 176s112-84 112-176c0-68-52-120-102-120z" fill="#fff" />
              <path d="M247 272c-26-16-42-32-42-50 0-14 11-24 24-24 9 0 15 4 18 10 3-6 9-10 18-10 13 0 24 10 24 24 0 18-16 34-42 50z" fill="#FD267D" />
            </svg>
            <div class="boot-name">U<span>Pin</span></div>
            <div class="boot-tag">знакомства ULove рядом</div>
            <div class="boot-bar"><span></span></div>
          </div>
        </div>
        <script nonce="{{ $cspNonce ?? '' }}">
            (function () {
                var boot = document.getElementById('pwa-boot');
                var hide = function () {
                    if (boot && !boot.classList.contains('done')) {
                        boot.classList.add('done');
                        setTimeout(function () {
                            try {
                                var want = window.__upinThemeBg || '';
                                if (want) document.documentElement.style.backgroundColor = want;
                            } catch (e) {}
                            if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
                            boot = null;
                        }, 450);
                    }
                };
                window.__upinHideSplash = hide;
                window.addEventListener('load', function () { setTimeout(hide, 800); });
                window.addEventListener('pageshow', function (e) { if (e.persisted) hide(); });
                setTimeout(hide, 6000);
            })();
        </script>
        @inertia
        @if(!$isNativeClient && !empty(($seoIntegrations ?? [])['scripts_enabled']) && !empty(($seoIntegrations ?? [])['body_end_scripts']))
        {!! ($seoIntegrations ?? [])['body_end_scripts'] !!}
        @endif
    </body>
</html>
