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
        <link rel="canonical" href="{{ url()->current() }}">

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
        @if(config('seo.twitter_site'))<meta name="twitter:site" content="{{ config('seo.twitter_site') }}">@endif

        <title inertia>{{ config('seo.default_title') }}</title>
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="apple-touch-icon" href="/favicon.ico">
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600,700,800,900&family=inter:400,500,600&display=swap" rel="stylesheet" />
        <script>
            (function(){ try{ var s=localStorage.getItem('theme'); var m=window.matchMedia('(prefers-color-scheme: dark)').matches; var d=s ? s==='dark' : m; if(d) document.documentElement.classList.add('dark'); document.documentElement.style.colorScheme = d?'dark':'light'; }catch(e){} })();
        </script>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "{{ config('seo.site_name') }}",
            "url": "{{ config('app.url') }}",
            "description": "{{ config('seo.default_description') }}",
            "inLanguage": "ru-RU",
            "potentialAction": {
                "@type": "SearchAction",
                "target": "{{ config('app.url') }}/map?q={search_term_string}",
                "query-input": "required name=search_term_string"
            }
        }
        </script>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "{{ config('seo.site_name') }}",
            "url": "{{ config('app.url') }}",
            "logo": "{{ url('/favicon.ico') }}"
        }
        </script>
        @routes
        @vite(['resources/js/app.ts'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-surface dark:bg-[#0B0F1A] text-ink-900 dark:text-zinc-100">
        @inertia
    </body>
</html>
