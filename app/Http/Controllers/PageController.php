<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Тонкий контроллер статичных Inertia-страниц.
 *
 * Нужен чтобы в routes/web.php не было Closure — иначе
 * `php artisan route:cache` / `optimize` падает на проде.
 */
class PageController extends Controller
{
    /**
     * Главная страница.
     *
     * Залогиненного сразу уводим в профиль без промежуточного лендинга:
     * иначе холодный старт (ввод домена, запуск PWA со start_url `/`)
     * показывает Welcome и только потом JS-редирект — мигание старта.
     *
     * @return InertiaResponse|RedirectResponse лендинг гостям, редирект в профиль своим
     */
    public function welcome(): InertiaResponse|RedirectResponse
    {
        if (auth()->check()) {
            return redirect()->route('dashboard');
        }

        $canLogin = Route::has('login');
        $canRegister = Route::has('register');

        return Inertia::render('Welcome', [
            'canLogin' => $canLogin,
            'canRegister' => $canRegister,
        ]);
    }

    /**
     * Редирект со старого /dashboard на /profile.
     *
     * @param string|null $identifier
     * @return RedirectResponse
     */
    public function dashboardRedirect(?string $identifier = null): RedirectResponse
    {
        $target = '/profile';
        $hasIdentifier = $identifier !== null && $identifier !== '';

        if ($hasIdentifier) {
            $target .= '/' . $identifier;
        }

        return redirect($target, 301);
    }

    /**
     * Админка.
     *
     * @return InertiaResponse
     */
    public function admin(): InertiaResponse
    {
        return Inertia::render('Admin/Index');
    }

    /**
     * Страница FAQ.
     *
     * @return InertiaResponse
     */
    public function faq(): InertiaResponse
    {
        return Inertia::render('Faq');
    }

    /**
     * Лента свайпов без вкладки.
     *
     * Бизнес-аккаунтам свайпы недоступны: это режим персоны,
     * компании живут в кабинете (/business) + карта + чаты.
     * Кабинет отдаём только когда модуль бизнеса реально доступен
     * (глобально включён и есть у пользователя), иначе бизнес
     * без кабинета уезжает на свой стартовый экран — прямой
     * редирект в кабинет давал петлю swipes ↔ cabinet и экран
     * «Вы оффлайн» в PWA при живом интернете.
     *
     * @return InertiaResponse|RedirectResponse
     */
    public function swipes(): InertiaResponse|RedirectResponse
    {
        $businessHome = $this->businessHome();

        if ($businessHome !== null) {
            return redirect($businessHome);
        }

        return Inertia::render('Swipes');
    }

    /**
     * Лента свайпов с вкладкой.
     *
     * @param string $tab
     * @return InertiaResponse|RedirectResponse
     */
    public function swipesTab(string $tab): InertiaResponse|RedirectResponse
    {
        $businessHome = $this->businessHome();

        if ($businessHome !== null) {
            return redirect($businessHome);
        }

        return Inertia::render('Swipes', ['tab' => $tab]);
    }

    /**
     * Справочная страница по слагу (contacts/privacy/offer).
     *
     * @param string $slug
     * @return InertiaResponse
     */
    public function reference(string $slug): InertiaResponse
    {
        return Inertia::render('Reference', ['slug' => $slug]);
    }

    /**
     * Лента Flow.
     *
     * Бизнес-аккаунтам недоступна, как и свайпы: UFlow — режим
     * персоны, компании работают через кабинет, карту и чаты.
     *
     * @return InertiaResponse|RedirectResponse
     */
    public function flow(): InertiaResponse|RedirectResponse
    {
        $businessHome = $this->businessHome();

        if ($businessHome !== null) {
            return redirect($businessHome);
        }

        return Inertia::render('Flow/Index');
    }

    /**
     * Конкретный пост во Flow.
     *
     * @param int $post
     * @return InertiaResponse|RedirectResponse
     */
    public function flowPost(int $post): InertiaResponse|RedirectResponse
    {
        $businessHome = $this->businessHome();

        if ($businessHome !== null) {
            return redirect($businessHome);
        }

        return Inertia::render('Flow/Index', ['postId' => $post]);
    }

    /**
     * Куда увести бизнес-аккаунт со страниц персоны (свайпы, Flow).
     *
     * Кабинет — только когда модуль бизнеса реально доступен пользователю
     * (глобальный гейт + персональный набор), иначе стартовый экран
     * пользователя (бизнес без кабинета — чаты, они не за гардом).
     * Возвращает null для не-бизнеса: страницу можно рендерить.
     *
     * @return string|null путь редиректа для бизнеса, null для персоны
     */
    private function businessHome(): ?string
    {
        if (! auth()->check()) {
            return null;
        }

        $user = auth()->user();

        if (! $user->isBusinessAccount()) {
            return null;
        }

        if ($user->hasModule('business')) {
            return route('cabinet.index', absolute: false);
        }

        return $user->landingPath();
    }

    /**
     * Чат (список или конкретный диалог).
     *
     * @param int|null $conversation
     * @return InertiaResponse
     */
    public function chat(?int $conversation = null): InertiaResponse
    {
        return Inertia::render('Chat/Index', ['conversationId' => $conversation]);
    }

    /**
     * Карта.
     *
     * @return InertiaResponse
     */
    public function map(): InertiaResponse
    {
        return Inertia::render('Map/Index');
    }

    /**
     * Fallback для неизвестных URL.
     *
     * Ассетам отдаем 404 (иначе HTML вместо JS),
     * гостям — на логин, остальным — на их лендинг.
     *
     * @param Request $request
     * @return mixed
     */
    public function fallback(Request $request): mixed
    {
        $isAsset = $request->is(
            'build/*',
            'sw.js',
            'workbox*',
            'manifest.webmanifest',
            'api/*',
            'broadcasting/*',
            'reverb/*',
            'up'
        );

        if ($isAsset) {
            abort(404);
        }

        $isGuest = ! auth()->check();

        if ($isGuest) {
            return redirect()->route('login');
        }

        $landingPath = auth()->user()->landingPath();

        return redirect($landingPath);
    }
}
