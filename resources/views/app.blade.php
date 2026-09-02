<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="color-scheme" content="light dark">
        <title inertia>{{ config('app.name', 'UPin') }}</title>
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230F172A'/%3E%3Ctext x='50' y='68' font-size='48' text-anchor='middle' fill='white' font-family='Arial' font-weight='900'%3E%E2%97%89%3C/text%3E%3C/svg%3E">
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600,700,800,900&family=inter:400,500,600&display=swap" rel="stylesheet" />
        <script>
            (function(){ try{ var s=localStorage.getItem('theme'); var m=window.matchMedia('(prefers-color-scheme: dark)').matches; var d=s ? s==='dark' : m; if(d) document.documentElement.classList.add('dark'); document.documentElement.style.colorScheme = d?'dark':'light'; }catch(e){} })();
        </script>
        @routes
        @vite(['resources/js/app.ts'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-surface dark:bg-[#0B0F1A] text-ink-900 dark:text-zinc-100">
        @inertia
    </body>
</html>
