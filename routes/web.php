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
Route::middleware('auth')->group(function () {
    Route::get('/chat/{conversation?}', fn (?int $conversation = null) => Inertia::render('Chat/Index', ['conversationId' => $conversation]))->name('chat');
    Route::get('/users/{user}', [ProfileController::class, 'publicShow'])->name('users.show');
    Route::get('/map', fn () => Inertia::render('Map/Index'))->name('map');
    Route::get('/settings/{identifier?}/{tab?}', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::post('/profile/avatar', [\App\Http\Controllers\AvatarController::class, 'store'])->name('profile.avatar');
});

Route::fallback(function () {
    if (!auth()->check()) {
        return redirect()->route('login');
    }
    return redirect()->route('dashboard');
});

require __DIR__.'/auth.php';
