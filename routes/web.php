<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard/{identifier?}', [ProfileController::class, 'dashboard'])->name('dashboard');
    Route::get('/admin', fn () => redirect()->route('dashboard', ['identifier' => 'admin']))->name('admin');
});

Route::get('/faq', fn () => Inertia::render('Faq'))->name('faq');
Route::middleware('auth')->group(function () {
    Route::get('/map', fn () => Inertia::render('Map/Index'))->name('map');
    Route::get('/settings/{identifier?}', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::get('/profile/{identifier?}', fn (?string $identifier = null) => redirect()->route('profile.edit', ['identifier' => $identifier]))->where('identifier', '.*');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::post('/profile/avatar', [\App\Http\Controllers\AvatarController::class, 'store'])->name('profile.avatar');
});

Route::fallback(function () {
    if (!auth()->check()) {
        return redirect()->route('login');
    }
    $u = auth()->user();
    $id = $u->isAdmin() ? 'admin' : (string) $u->id;
    return redirect()->route('dashboard', ['identifier' => $id]);
});

require __DIR__.'/auth.php';
