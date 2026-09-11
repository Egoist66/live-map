<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SeoController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/robots.txt', [SeoController::class, 'robots']);
Route::get('/sitemap.xml', [SeoController::class, 'sitemap']);

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/profile/{identifier?}', [ProfileController::class, 'dashboard'])->name('dashboard');
    Route::get('/dashboard/{identifier?}', function (?string $identifier = null) {
        $target = '/profile' . ($identifier ? '/' . $identifier : '');
        return redirect($target, 301);
    })->where('identifier', '.*');
    Route::get('/admin', fn () => Inertia::render('Admin/Index'))->middleware('admin')->name('admin');
});

Route::get('/faq', fn () => Inertia::render('Faq'))->name('faq');
Route::get('/swipes', fn () => Inertia::render('Swipes'))->name('swipes');
Route::get('/swipes/{tab}', fn (string $tab) => Inertia::render('Swipes', ['tab' => $tab]))
    ->where('tab', 'tape|active|favorites|admirers|questionnaire|premium')
    ->name('swipes.tab');
Route::get('/contacts', fn () => Inertia::render('Reference', ['slug' => 'contacts']))->name('contacts');
Route::get('/privacy', fn () => Inertia::render('Reference', ['slug' => 'privacy']))->name('privacy');
Route::get('/offer', fn () => Inertia::render('Reference', ['slug' => 'offer']))->name('offer');
Route::middleware('auth')->group(function () {
    Route::get('/flow', fn () => Inertia::render('Flow/Index'))->name('flow');
    Route::get('/flow/post/{post}', fn (int $post) => Inertia::render('Flow/Index', ['postId' => $post]))->whereNumber('post')->name('flow.post');
    Route::get('/chat/{conversation?}', fn (?int $conversation = null) => Inertia::render('Chat/Index', ['conversationId' => $conversation]))->name('chat');
    Route::get('/users/{user}', [ProfileController::class, 'publicShow'])->name('users.show');
    Route::get('/map', fn () => Inertia::render('Map/Index'))->name('map');
    Route::get('/settings/{identifier?}/{tab?}', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->middleware('throttle:profile-write')->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->middleware('throttle:profile-write')->name('profile.destroy');
    Route::post('/profile/avatar', [\App\Http\Controllers\AvatarController::class, 'store'])->middleware('throttle:profile-write')->name('profile.avatar');
    Route::post('/terms/accept', [\App\Http\Controllers\TermsController::class, 'accept'])->name('terms.accept');
});

Route::fallback(function () {
    if (!auth()->check()) {
        return redirect()->route('login');
    }
    return redirect()->route('dashboard');
});

require __DIR__.'/auth.php';
