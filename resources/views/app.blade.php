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
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600,700,800,900&family=inter:400,500,600&display=swap" rel="stylesheet">
        <script nonce="{{ $cspNonce ?? '' }}">
            (function(){ try{ var s=localStorage.getItem('theme'); var m=window.matchMedia('(prefers-color-scheme: dark)').matches; var d=s ? s==='dark' : m; if(d) document.documentElement.classList.add('dark'); document.documentElement.style.colorScheme = d?'dark':'light'; var bg=d?'#0F121F':'#ffffff'; document.documentElement.style.backgroundColor=bg; }catch(e){} })();
        </script>
        {{-- Прелоадер: тонкая полоса сверху на время первой загрузки.
              Полноэкранного boot-экрана с логотипом больше нет: приложение
              сразу рисует контент, навигационный прогресс Inertia
              (`progress: { color }` в `app.ts`) показывает переходы. --}}
        <style nonce="{{ $cspNonce ?? '' }}">
          #mini-loader {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            z-index: 9998;
            overflow: hidden;
            background: rgba(253, 38, 125, .14);
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
            background: linear-gradient(90deg, #FD267D, #E936C7, #FF7854);
            box-shadow: 0 0 12px rgba(253, 38, 125, .8);
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
        <div id="mini-loader" role="status" aria-label="Загрузка"><span></span></div>
        <script nonce="{{ $cspNonce ?? '' }}">
            (function () {
                var mini = document.getElementById('mini-loader');
                var hide = function () {
                    if (mini && !mini.classList.contains('done')) {
                        mini.classList.add('done');
                        setTimeout(function () {
                            if (mini && mini.parentNode) mini.parentNode.removeChild(mini);
                            mini = null;
                        }, 500);
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
