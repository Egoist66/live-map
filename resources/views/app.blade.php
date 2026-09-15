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
        <meta name="msapplication-TileColor" content="#0F121F">
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0F121F">

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
            (function(){ try{ var s=localStorage.getItem('theme'); var m=window.matchMedia('(prefers-color-scheme: dark)').matches; var d=s ? s==='dark' : m; if(d) document.documentElement.classList.add('dark'); document.documentElement.style.colorScheme = d?'dark':'light'; var bg=d?'#0F121F':'#ffffff'; document.documentElement.style.backgroundColor=bg; }catch(e){} })();
        </script>
        {{-- Тонкий градиентный лоадер сверху (десктоп и PWA). Системный сплэш PWA (иконка + UPin из манифеста) рисует сам Chrome. --}}
        <style nonce="{{ $cspNonce ?? '' }}">
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
            animation: mini-load 1.1s ease-in-out infinite;
          }
          @keyframes mini-load {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(280%); }
          }
          @media (prefers-reduced-motion: reduce) {
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
        <div id="mini-loader" role="status" aria-label="Загрузка"><span></span></div>
        <script nonce="{{ $cspNonce ?? '' }}">
            (function () {
                var mini = document.getElementById('mini-loader');
                var hide = function () {
                    if (!mini || mini.classList.contains('done')) return;
                    mini.classList.add('done');
                    setTimeout(function () {
                        if (mini && mini.parentNode) mini.parentNode.removeChild(mini);
                        mini = null;
                    }, 500);
                };
                window.__upinHideSplash = hide;
                window.addEventListener('load', function () { setTimeout(hide, 800); });
                window.addEventListener('pageshow', function (e) { if (e.persisted) hide(); });
                setTimeout(hide, 6000);
            })();
        </script>
        @inertia
    </body>
</html>
