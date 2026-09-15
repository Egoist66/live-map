<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content, viewport-fit=cover">
        <meta name="color-scheme" content="light dark">
        <meta name="theme-color" content="{{ config('seo.theme_color', '#0F172A') }}">
        <meta name="robots" content="{{ config('seo.robots') }}">
        <meta name="author" content="{{ config('seo.author') }}">
        <meta name="description" content="{{ config('seo.default_description') }}">
        <meta name="keywords" content="{{ implode(', ', config('seo.keywords', [])) }}">
        <meta name="format-detection" content="telephone=no">
        <meta name="vapid-public-key" content="{{ config('services.webpush.vapid.public_key') }}">
        <link rel="canonical" href="{{ url()->current() }}">

        <link rel="manifest" href="/manifest.webmanifest">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="application-name" content="{{ config('seo.site_name') }}">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="{{ config('seo.site_name') }}">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="msapplication-TileColor" content="#0B0F1A">
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0B0F1A">

        <meta property="og:site_name" content="{{ config('seo.site_name') }}">
        <meta property="og:type" content="{{ config('seo.og_type', 'website') }}">
        <meta property="og:locale" content="{{ config('seo.locale', 'ru_RU') }}">
        <meta property="og:url" content="{{ url()->current() }}">
        <meta property="og:title" content="{{ config('seo.default_title') }}">
        <meta property="og:description" content="{{ config('seo.default_description') }}">
        <meta property="og:image" content="{{ url(config('seo.image', '/og-cover.jpg')) }}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">

        <meta name="twitter:card" content="{{ config('seo.twitter_card', 'summary_large_image') }}">
        <meta name="twitter:title" content="{{ config('seo.default_title') }}">
        <meta name="twitter:description" content="{{ config('seo.default_description') }}">
        <meta name="twitter:image" content="{{ url(config('seo.image', '/og-cover.jpg')) }}">
        @if(config('seo.twitter_site'))
            <meta name="twitter:site" content="{{ config('seo.twitter_site') }}">
        @endif
        <title inertia>{{ config('seo.default_title') }}</title>
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/pwa-icon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600,700,800,900&family=inter:400,500,600&display=swap" rel="stylesheet" />
        <script nonce="{{ $cspNonce ?? '' }}">
            (function(){ try{ var s=localStorage.getItem('theme'); var m=window.matchMedia('(prefers-color-scheme: dark)').matches; var d=s ? s==='dark' : m; if(d) document.documentElement.classList.add('dark'); document.documentElement.style.colorScheme = d?'dark':'light'; var bg=d?'#0B0F1A':'#ffffff'; document.documentElement.style.backgroundColor=bg; }catch(e){} })();
        </script>
        {{-- UPin splash: брендированный экран загрузки PWA (первый кадр до CSS/JS) --}}
        <style nonce="{{ $cspNonce ?? '' }}">
          #pwa-splash {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: radial-gradient(120% 90% at 50% 0%, #1B2350 0%, #0B0F1A 55%, #070B16 100%);
            color: #fff;
            transition: opacity .55s ease, visibility .55s ease;
          }
          #pwa-splash.done {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
          }
          #pwa-splash .sp-map {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            opacity: .55;
          }
          #pwa-splash .sp-glow {
            position: absolute;
            border-radius: 9999px;
            filter: blur(90px);
            animation: sp-drift 9s ease-in-out infinite alternate;
          }
          #pwa-splash .sp-glow-a {
            width: 420px;
            height: 420px;
            left: -120px;
            top: -120px;
            background: #5B5BFF;
            opacity: .35;
          }
          #pwa-splash .sp-glow-b {
            width: 360px;
            height: 360px;
            right: -110px;
            bottom: -90px;
            background: #06B6D4;
            opacity: .22;
            animation-delay: -4s;
          }
          @keyframes sp-drift {
            from { transform: translate3d(0, 0, 0) scale(1); }
            to { transform: translate3d(40px, 30px, 0) scale(1.12); }
          }
          #pwa-splash .sp-rings {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 300px;
            height: 300px;
            transform: translate(-50%, -50%);
          }
          #pwa-splash .sp-ring {
            position: absolute;
            inset: 0;
            border-radius: 9999px;
            border: 1.5px solid rgba(255, 255, 255, .22);
            animation: sp-ring 2.8s ease-out infinite;
          }
          #pwa-splash .sp-ring:nth-child(2) { animation-delay: .9s; }
          #pwa-splash .sp-ring:nth-child(3) { animation-delay: 1.8s; }
          @keyframes sp-ring {
            from { transform: scale(.35); opacity: .9; }
            to { transform: scale(1.15); opacity: 0; }
          }
          #pwa-splash .sp-card {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 0 32px;
            animation: sp-rise .7s cubic-bezier(.22, 1, .36, 1) both;
          }
          @keyframes sp-rise {
            from { transform: translateY(18px); opacity: 0; }
            to { transform: none; opacity: 1; }
          }
          #pwa-splash .sp-logo {
            width: 96px;
            height: 96px;
            border-radius: 28px;
            background: linear-gradient(135deg, #6D6DFF, #4A3AFF);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 18px 60px -12px rgba(91, 91, 255, .75), inset 0 1px 0 rgba(255, 255, 255, .35);
            animation: sp-float 3.2s ease-in-out infinite;
            position: relative;
            overflow: hidden;
          }
          #pwa-splash .sp-logo::after {
            content: '';
            position: absolute;
            top: -20%;
            bottom: -20%;
            width: 45%;
            left: -60%;
            background: linear-gradient(105deg, transparent, rgba(255, 255, 255, .5), transparent);
            transform: skewX(-18deg);
            pointer-events: none;
            animation: sp-shine 2.6s ease-in-out infinite;
          }
          @keyframes sp-shine {
            0% { left: -60%; }
            55%, 100% { left: 130%; }
          }
          @keyframes sp-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          #pwa-splash .sp-name {
            margin: 20px 0 0;
            font-family: Figtree, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            font-size: 44px;
            line-height: 1;
            font-weight: 800;
            letter-spacing: .01em;
          }
          #pwa-splash .sp-hook {
            margin-top: 10px;
            font-size: 17px;
            font-weight: 700;
            letter-spacing: .01em;
            background: linear-gradient(90deg, #A5AAFF, #67E8F9 50%, #FDA4AF);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            animation: sp-rise .7s .12s cubic-bezier(.22, 1, .36, 1) both;
          }
          #pwa-splash .sp-tag {
            margin-top: 12px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 14px;
            border-radius: 999px;
            font-size: 13.5px;
            font-weight: 600;
            letter-spacing: .04em;
            color: #DDE1FF;
            background: rgba(255, 255, 255, .08);
            border: 1px solid rgba(255, 255, 255, .14);
            animation: sp-rise .7s .2s cubic-bezier(.22, 1, .36, 1) both;
          }
          #pwa-splash .sp-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #34D399;
            animation: sp-blink 1.6s ease-out infinite;
          }
          @keyframes sp-blink {
            0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, .65); }
            70% { box-shadow: 0 0 0 9px rgba(52, 211, 153, 0); }
            100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
          }
          #pwa-splash .sp-chips {
            margin-top: 18px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: center;
            animation: sp-rise .7s .28s cubic-bezier(.22, 1, .36, 1) both;
          }
          #pwa-splash .sp-chip {
            padding: 6px 12px;
            border-radius: 999px;
            font-size: 12.5px;
            font-weight: 600;
            color: rgba(255, 255, 255, .85);
            background: rgba(255, 255, 255, .06);
            border: 1px solid rgba(255, 255, 255, .1);
          }
          #pwa-splash .sp-bar {
            margin-top: 26px;
            width: 184px;
            height: 5px;
            border-radius: 999px;
            background: rgba(255, 255, 255, .12);
            overflow: hidden;
            animation: sp-rise .7s .36s cubic-bezier(.22, 1, .36, 1) both;
          }
          #pwa-splash .sp-bar > span {
            display: block;
            height: 100%;
            width: 40%;
            border-radius: inherit;
            background: linear-gradient(90deg, #5B5BFF, #06B6D4);
            animation: sp-load 1.15s ease-in-out infinite;
          }
          @keyframes sp-load {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(280%); }
          }
          #mini-loader {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            z-index: 9998;
            overflow: hidden;
            background: rgba(91, 91, 255, .12);
            transition: opacity .4s ease, visibility .4s ease;
          }
          #mini-loader.done {
            opacity: 0;
            visibility: hidden;
          }
          #mini-loader > span {
            display: block;
            height: 100%;
            width: 35%;
            border-radius: inherit;
            background: linear-gradient(90deg, #5B5BFF, #06B6D4, #FDA4AF);
            box-shadow: 0 0 12px rgba(91, 91, 255, .8);
            animation: sp-load 1.1s ease-in-out infinite;
          }
          #pwa-splash .sp-ping {
            transform-origin: center;
            transform-box: fill-box;
            animation: sp-svgping 2.4s ease-out infinite;
          }
          @keyframes sp-svgping {
            0% { transform: scale(.4); opacity: .8; }
            100% { transform: scale(1.6); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            #pwa-splash *, #pwa-splash *::before, #pwa-splash *::after,
            #mini-loader *, #mini-loader *::before, #mini-loader *::after {
              animation: none !important;
            }
          }
        </style>
        <script type="application/ld+json">
        {
            "@@context": "https://schema.org",
            "@@type": "WebSite",
            "name": "{{ config('seo.site_name') }}",
            "url": "{{ config('app.url') }}",
            "description": "{{ config('seo.default_description') }}",
            "inLanguage": "ru-RU",
            "potentialAction": {
                "@@type": "SearchAction",
                "target": "{{ config('app.url') }}/map?q={search_term_string}",
                "query-input": "required name=search_term_string"
            }
        }
        </script>
        <script type="application/ld+json">
        {
            "@@context": "https://schema.org",
            "@@type": "Organization",
            "name": "{{ config('seo.site_name') }}",
            "url": "{{ config('app.url') }}",
            "logo": "{{ url('/favicon.ico') }}"
        }
        </script>
        {!! app(\Tighten\Ziggy\BladeRouteGenerator::class)->generate(nonce: $cspNonce ?? null) !!}
        @vite(['resources/js/app.ts'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-surface dark:bg-[#0B0F1A] text-ink-900 dark:text-zinc-100">
        <div id="pwa-splash" role="status" aria-label="UPin загружается">
            <svg class="sp-map" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <g stroke="rgba(255,255,255,.07)" stroke-width="2" fill="none">
                    <path d="M-20 120 C 80 110, 180 140, 420 115" />
                    <path d="M-20 260 C 90 250, 200 280, 420 255" />
                    <path d="M-20 400 C 100 390, 210 420, 420 395" />
                    <path d="M-20 540 C 90 530, 200 560, 420 535" />
                    <path d="M-20 680 C 100 670, 210 700, 420 675" />
                    <path d="M60 -20 C 55 200, 75 500, 60 820" />
                    <path d="M150 -20 C 145 200, 165 500, 150 820" />
                    <path d="M240 -20 C 235 200, 255 500, 240 820" />
                    <path d="M330 -20 C 325 200, 345 500, 330 820" />
                </g>
                <path d="M-20 470 C 80 440, 120 520, 200 500 C 280 480, 300 560, 420 530" stroke="rgba(6,182,212,.28)" stroke-width="14" fill="none" stroke-linecap="round" />
                <g fill="rgba(255,255,255,.045)">
                    <rect x="170" y="140" width="52" height="44" rx="8" />
                    <rect x="258" y="290" width="56" height="46" rx="8" />
                    <rect x="76" y="570" width="58" height="48" rx="8" />
                    <rect x="262" y="600" width="50" height="42" rx="8" />
                </g>
                <g>
                    <circle cx="84" cy="180" r="16" fill="none" stroke="#5B5BFF" stroke-width="2" class="sp-ping" />
                    <circle cx="84" cy="180" r="8" fill="#5B5BFF" />
                    <circle cx="318" cy="430" r="16" fill="none" stroke="#FF6B8B" stroke-width="2" class="sp-ping" style="animation-delay:.8s" />
                    <circle cx="318" cy="430" r="8" fill="#FF6B8B" />
                    <circle cx="196" cy="636" r="16" fill="none" stroke="#06B6D4" stroke-width="2" class="sp-ping" style="animation-delay:1.6s" />
                    <circle cx="196" cy="636" r="8" fill="#06B6D4" />
                </g>
            </svg>
            <div class="sp-glow sp-glow-a"></div>
            <div class="sp-glow sp-glow-b"></div>
            <div class="sp-rings" aria-hidden="true">
                <div class="sp-ring"></div>
                <div class="sp-ring"></div>
                <div class="sp-ring"></div>
            </div>
            <div class="sp-card">
                <div class="sp-logo">
                    <svg width="52" height="52" viewBox="0 0 512 512" aria-hidden="true">
                        <path d="M256 108c-70 0-122 52-122 120 0 92 112 176 112 176s112-84 112-176c0-68-52-120-102-120z" fill="#fff"/>
                        <circle cx="256" cy="228" r="52" fill="#5B5BFF"/>
                        <circle cx="256" cy="228" r="22" fill="#fff"/>
                    </svg>
                </div>
                <div class="sp-name">UPin</div>
                <div class="sp-hook">Твой район оживает здесь</div>
                <div class="sp-tag"><span class="sp-dot"></span>живая карта района</div>
                <div class="sp-chips">
                    <span class="sp-chip">📍 Пины рядом</span>
                    <span class="sp-chip">💬 Чаты</span>
                    <span class="sp-chip">💞 ULove</span>
                </div>
                <div class="sp-bar"><span></span></div>
            </div>
        </div>
        <div id="mini-loader" role="status" aria-label="Загрузка"><span></span></div>
        <script nonce="{{ $cspNonce ?? '' }}">
            (function () {
                var splash = document.getElementById('pwa-splash');
                var mini = document.getElementById('mini-loader');
                var isPwa = false;
                try {
                    isPwa = window.matchMedia('(display-mode: standalone)').matches
                        || window.matchMedia('(display-mode: fullscreen)').matches
                        || window.matchMedia('(display-mode: minimal-ui)').matches
                        || (window.navigator && window.navigator.standalone === true)
                        || /(^|[?&])source=pwa/.test(window.location.search);
                } catch (e) {}
                if (!isPwa) {
                    if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
                    splash = null;
                } else {
                    if (mini && mini.parentNode) mini.parentNode.removeChild(mini);
                    mini = null;
                }
                var hide = function () {
                    [splash, mini].forEach(function (el) {
                        if (!el || el.classList.contains('done')) return;
                        el.classList.add('done');
                    });
                    setTimeout(function () {
                        [splash, mini].forEach(function (el) {
                            if (el && el.parentNode) el.parentNode.removeChild(el);
                        });
                        splash = null;
                        mini = null;
                    }, 750);
                };
                window.__upinHideSplash = hide;
                window.addEventListener('load', function () { setTimeout(hide, 2200); });
                document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(hide, 1200); });
                window.addEventListener('pageshow', function (e) { if (e.persisted) hide(); });
                setTimeout(hide, 6000);
            })();
        </script>
        @inertia
    </body>
</html>
