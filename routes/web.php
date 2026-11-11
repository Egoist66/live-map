<?php

use App\Http\Controllers\AvatarController;
use App\Http\Controllers\BrandingController;
use App\Http\Controllers\BusinessController;
use App\Http\Controllers\DistrictController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SeoController;
use App\Http\Controllers\TermsController;
use Illuminate\Support\Facades\Route;

Route::get('/robots.txt', [SeoController::class, 'robots']);
Route::get('/sitemap.xml', [SeoController::class, 'sitemap']);
Route::get('/site.webmanifest', [BrandingController::class, 'manifest'])->name('branding.manifest');
// Легаси-URL манифеста: его хранят PWA-установки до 22.10 (Chrome
// перечитывает манифест по URL, зафиксированному при установке).
// Отдаём тот же theme-aware контроллер, чтобы у старых установок
// фон окна за системной полосой жестов совпадал с цветом навигации.
Route::get('/manifest.webmanifest', [BrandingController::class, 'manifest'])->name('branding.manifest.legacy');
Route::get('/branding/icon', [BrandingController::class, 'icon'])->name('branding.icon');

Route::get('/', [PageController::class, 'welcome']);

Route::middleware(['auth'])->group(function () {
    // Анкета-онбординг Mini App: открыта гейтом, сюда же он редиректит
    // взаперти-сессии. Форма добивает профиль и снимает флаг.
    Route::get('/onboarding', [PageController::class, 'onboarding'])->name('onboarding');
    Route::get('/profile/{identifier?}', [ProfileController::class, 'dashboard'])->name('dashboard');
    Route::get('/dashboard/{identifier?}', [PageController::class, 'dashboardRedirect'])->where('identifier', '.*');
    Route::get('/admin/{tab?}/{seo?}', [PageController::class, 'admin'])
        ->where([
            'tab' => 'stats|manage|security|admin|business|support|modules|ai|refs|seo|telegram|payments|branding',
            'seo' => 'general|pages|integrations|scripts|crawl',
        ])
        ->middleware('admin:moderator')
        ->name('admin');
});

Route::get('/faq', [PageController::class, 'faq'])->name('faq');
Route::get('/swipes', [PageController::class, 'swipes'])->middleware('module:ulove')->name('swipes');
Route::get('/swipes/{tab}', [PageController::class, 'swipesTab'])
    ->where('tab', 'tape|active|favorites|admirers|questionnaire|premium')
    ->middleware('module:ulove')
    ->name('swipes.tab');
Route::get('/contacts', [PageController::class, 'reference'])->defaults('slug', 'contacts')->name('contacts');
Route::get('/privacy', [PageController::class, 'reference'])->defaults('slug', 'privacy')->name('privacy');
Route::get('/offer', [PageController::class, 'reference'])->defaults('slug', 'offer')->name('offer');
Route::middleware('auth')->group(function () {
    Route::get('/cabinet', [BusinessController::class, 'index'])->middleware('module:business')->name('cabinet.index');
    Route::get('/cabinet/pins', [BusinessController::class, 'pinsPage'])->middleware('module:business')->name('cabinet.pins');
    Route::get('/cabinet/onboarding', [BusinessController::class, 'onboarding'])->middleware('module:business')->name('cabinet.onboarding');
    Route::get('/cabinet/settings', [BusinessController::class, 'settings'])->middleware('module:business')->name('cabinet.settings');
    Route::get('/flow', [PageController::class, 'flow'])->middleware('module:uflow')->name('flow');
    Route::get('/flow/post/{post}', [PageController::class, 'flowPost'])->whereNumber('post')->middleware('module:uflow')->name('flow.post');
    Route::get('/chat/{conversation?}', [PageController::class, 'chat'])->name('chat');
    Route::get('/users/{profile}', [ProfileController::class, 'publicShow'])->name('users.show');
    Route::get('/map', [PageController::class, 'map'])->middleware('module:upin')->name('map');
    Route::get('/districts', [DistrictController::class, 'pageIndex'])->middleware('module:districts')->name('districts.index');
    Route::get('/districts/create', [DistrictController::class, 'pageCreate'])->middleware('module:districts')->name('districts.create');
    Route::get('/districts/{district}', [DistrictController::class, 'pageShow'])->whereNumber('district')->middleware('module:districts')->name('districts.show');
    Route::get('/settings/{identifier?}/{tab?}', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->middleware('throttle:profile-write')->name('profile.update');
    Route::patch('/profile/thought', [ProfileController::class, 'updateThought'])->middleware('throttle:profile-write')->name('profile.thought');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->middleware('throttle:profile-write')->name('profile.destroy');
    Route::post('/profile/avatar', [AvatarController::class, 'store'])->middleware('throttle:profile-write')->name('profile.avatar');
    Route::post('/terms/accept', [TermsController::class, 'accept'])->name('terms.accept');
});

Route::fallback([PageController::class, 'fallback']);

require __DIR__.'/auth.php';
require __DIR__.'/pipe.php';
