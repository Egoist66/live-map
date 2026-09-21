<?php

namespace App\Providers;

use App\Models\Pin;
use App\Models\PinComment;
use App\Policies\CommentPolicy;
use App\Policies\PinPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

/**
 * Корневой сервис-провайдер приложения.
 *
 * Зачем нужен:
 * - Это точка входа для глобальной инициализации приложения. Laravel
 *   автоматически вызывает у него два этапа при загрузке:
 *   1) `register()` — привязка сервисов в IoC-контейнер (без обращения
 *      к другим сервисам);
 *   2) `boot()` — настройка уже зарегистрированных сервисов
 *      (события, политики доступа, rate-лимитеры, URL, Vite).
 * - В данном проекте провайдер выполняет четыре ответственности:
 *   1) Принудительная HTTPS-схема за reverse-proxy (по заголовку
 *      `X-Forwarded-Proto`), чтобы `route()`/`asset()` генерировали
 *      корректные ссылки.
 *   2) Настройка Vite (`prefetch`), чтобы ускорить подгрузку чанков фронта.
 *   3) Регистрация Gate-политик (`Pin` → `PinPolicy`,
 *      `PinComment` → `CommentPolicy`) + глобальный `Gate::before`
 *      для администратора (админ проходит любую проверку).
 *   4) Регистрация именованных rate-лимитеров (`RateLimiter::for(...)`),
 *      которые затем используются в роутах через `throttle:<name>`
 *      для защиты auth, пинов, комментариев, чата, realtime и т.д.
 *
 * Когда срабатывает:
 * - Один раз за жизненный цикл HTTP-запроса / Artisan-команды /
 *   queue-воркера, после регистрации всех провайдеров из
 *   `bootstrap/providers.php` и `config/app.php`.
 *
 * @see \Illuminate\Support\ServiceProvider Базовый класс провайдеров.
 * @see \App\Policies\PinPolicy Правила доступа к пинам.
 * @see \App\Policies\CommentPolicy Правила доступа к комментариям.
 */
class AppServiceProvider extends ServiceProvider
{
    /**
     * Зарегистрировать сервисы в IoC-контейнере.
     *
     * Сейчас привязок нет: метод оставлен пустым как точка расширения.
     * Сюда добавляют `$this->app->singleton(...)` / `bind(...)`, когда
     * появится сервис, требующий ленивой регистрации без сайд-эффектов.
     *
     * @return void
     */
    public function register(): void {}

    /**
     * Проинициализировать сервисы приложения.
     *
     * Делегирует работу приватным методам — один метод = одно действие
     * (Правило №3 проекта). Вызывается после того, как все провайдеры
     * прошли `register()`, поэтому здесь безопасно обращаться к
     * фасадам `URL`, `Vite`, `Gate`, `RateLimiter`.
     *
     * @return void
     */
    public function boot(): void
    {
        $this->configureUrlScheme();
        $this->configureVitePrefetch();
        $this->registerAuthorizationPolicies();
        $this->registerRateLimiters();
        $this->shareSeoHead();
    }

    /**
     * Принудительно включить HTTPS-схему за reverse-proxy.
     *
     * Если прокси (nginx/Caddy/Cloudflare) терминирует TLS и прокидывает
     * заголовок `X-Forwarded-Proto: https`, Laravel иначе сгенерирует
     * http-ссылки. `URL::forceScheme('https')` это исправляет.
     *
     * @return void
     */
    private function configureUrlScheme(): void
    {
        $forwardedProto = request()->header('X-Forwarded-Proto');

        $isBehindHttpsProxy = $forwardedProto === 'https';

        if (! $isBehindHttpsProxy) {
            return;
        }

        URL::forceScheme('https');
    }

    /**
     * Настроить предзагрузку Vite-чанков.
     *
     * `prefetch(concurrency: 3)` добавляет `<link rel="prefetch">`
     * для ленивых чанков, чтобы навигация по SPA ощущалась быстрее,
     * но не перегружала сеть (не более 3 параллельных загрузок).
     *
     * @return void
     */
    private function configureVitePrefetch(): void
    {
        Vite::prefetch(concurrency: 3);
    }

    /**
     * Поделиться динамическим SEO с корневым blade-шаблоном.
     *
     * View-композер для resources/views/app.blade.php: кладёт в вид
     * $seoHead (мета для head) и $seoIntegrations (верификации, счётчики,
     * произвольные скрипты из админки). Значения берутся из
     * SeoSettingsService — то, что админ сохранил в панели SEO,
     * применяется без правки кода. При ошибке БД отдаём дефолты
     * из config/seo.php, чтобы страница никогда не падала.
     *
     * @return void
     */
    private function shareSeoHead(): void
    {
        View::composer('app', static function (\Illuminate\View\View $view): void {
            try {
                $currentRequest = request();
                $currentPath = '/' . ltrim($currentRequest->path(), '/');

                if ($currentPath === '//') {
                    $currentPath = '/';
                }

                $head = \App\Services\SeoSettingsService::forHead($currentRequest->url(), $currentPath);
                $integrations = \App\Services\SeoSettingsService::integrations();
            } catch (\Throwable) {
                $head = [
                    'site_name' => config('seo.site_name'),
                    'title' => config('seo.default_title'),
                    'description' => config('seo.default_description'),
                    'keywords' => implode(', ', config('seo.keywords', [])),
                    'author' => config('seo.author'),
                    'locale' => config('seo.locale', 'ru_RU'),
                    'og_type' => config('seo.og_type', 'website'),
                    'twitter_card' => config('seo.twitter_card', 'summary_large_image'),
                    'twitter_site' => config('seo.twitter_site'),
                    'theme_color' => config('seo.theme_color', '#0F172A'),
                    'og_image' => config('seo.image', '/og-cover.jpg'),
                    'og_title' => config('seo.default_title'),
                    'og_description' => config('seo.default_description'),
                    'canonical' => url()->current(),
                    'robots' => config('seo.robots'),
                ];
                $integrations = ['scripts_enabled' => false];
            }

            $view->with('seoHead', $head);
            $view->with('seoIntegrations', $integrations);
        });
    }

    /**
     * Зарегистрировать политики авторизации и суперадмина.
     *
     * - `Pin` проверяется через `PinPolicy`;
     * - `PinComment` проверяется через `CommentPolicy`;
     * - `Gate::before` даёт пользователю с `isAdmin() === true`
     *   автоматический доступ к любой способности (`return true`),
     *   для обычных пользователей возвращает `null` и проверка
     *   продолжается в конкретной политике.
     *
     * @return void
     */
    private function registerAuthorizationPolicies(): void
    {
        Gate::policy(Pin::class, PinPolicy::class);
        Gate::policy(PinComment::class, CommentPolicy::class);

        Gate::before(function ($user, string $ability): ?bool {
            if ($user->isAdmin()) {
                return true;
            }

            return null;
        });
    }

    /**
     * Зарегистрировать именованные rate-лимитеры.
     *
     * Ключ ограничения выбирается замыканиями:
     * - `$keyByIp` — для гостевых auth-эндпоинтов (юзера ещё нет);
     * - `$keyByUser` — для авторизованных действий (изоляция по юзеру).
     *
     * Имя лимитера = значение для middleware `throttle:<name>` в роутах.
     *
     * @return void
     */
    private function registerRateLimiters(): void
    {
        /** @var callable(Request): string Ключ лимита по ID пользователя. */
        $keyByUser = fn (Request $request) => 'user:'.$request->user()?->getAuthIdentifier();

        /** @var callable(Request): string Ключ лимита по IP-адресу. */
        $keyByIp = fn (Request $request) => 'ip:'.$request->ip();

        $this->registerAuthRateLimiters($keyByUser, $keyByIp);
        $this->registerDomainRateLimiters($keyByUser);
    }

    /**
     * Зарегистрировать лимитеры auth-зоны (защита от брутфорса/спама).
     *
     * @param callable(Request): string $keyByUser Ключ лимита по пользователю.
     * @param callable(Request): string $keyByIp   Ключ лимита по IP.
     *
     * @return void
     */
    private function registerAuthRateLimiters(callable $keyByUser, callable $keyByIp): void
    {
        RateLimiter::for('auth-login', function (Request $request) use ($keyByIp) {
            return Limit::perMinute(10)->by($keyByIp($request));
        });

        RateLimiter::for('auth-register', function (Request $request) use ($keyByIp) {
            return Limit::perMinute(5)->by($keyByIp($request));
        });

        RateLimiter::for('auth-forgot', function (Request $request) use ($keyByIp) {
            return Limit::perMinute(3)->by($keyByIp($request));
        });

        RateLimiter::for('auth-reset', function (Request $request) use ($keyByIp) {
            return Limit::perMinute(6)->by($keyByIp($request));
        });

        RateLimiter::for('auth-confirm', function (Request $request) use ($keyByUser) {
            return Limit::perMinute(10)->by($keyByUser($request));
        });
    }

    /**
     * Зарегистрировать лимитеры доменной зоны (пины, чат, соцсети).
     *
     * @param callable(Request): string $keyByUser Ключ лимита по пользователю.
     *
     * @return void
     */
    private function registerDomainRateLimiters(callable $keyByUser): void
    {
        $limitsByName = [
            'pins-index' => 120,
            'pins-write' => 20,
            'comments-write' => 60,
            'messages-write' => 60,
            'pin-toggle' => 60,
            'chat-signal' => 120,
            'video-signal' => 300,
            'realtime-sync' => 60,
            'reactions' => 120,
            'chat-search' => 30,
            'social-write' => 60,
            'screen-lock' => 30,
            'reports' => 10,
            'push-test' => 10,
            'profile-write' => 30,
        ];

        foreach ($limitsByName as $limiterName => $perMinute) {
            RateLimiter::for($limiterName, function (Request $request) use ($keyByUser, $perMinute) {
                return Limit::perMinute($perMinute)->by($keyByUser($request));
            });
        }
    }
}
