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
     * @return InertiaResponse
     */
    public function welcome(): InertiaResponse
    {
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
     * @return InertiaResponse
     */
    public function swipes(): InertiaResponse
    {
        return Inertia::render('Swipes');
    }

    /**
     * Лента свайпов с вкладкой.
     *
     * @param string $tab
     * @return InertiaResponse
     */
    public function swipesTab(string $tab): InertiaResponse
    {
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
     * @return InertiaResponse
     */
    public function flow(): InertiaResponse
    {
        return Inertia::render('Flow/Index');
    }

    /**
     * Конкретный пост во Flow.
     *
     * @param int $post
     * @return InertiaResponse
     */
    public function flowPost(int $post): InertiaResponse
    {
        return Inertia::render('Flow/Index', ['postId' => $post]);
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
