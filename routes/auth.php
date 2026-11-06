<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\ConfirmablePasswordController;
use App\Http\Controllers\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\VerifyEmailController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    // Отдельной страницы регистрации нет: вход и регистрация — тогл
    // на одной странице Auth/Login. Имя register висит
    // на POST, чтобы route('register') и Route::has('register') работали.
    // GET-редирект пишем только на GET: Route::redirect() создаёт ANY-роут
    // и в коллекции POST затирает одноимённый named-роут
    // (`routes[POST]['/register']`), из-за чего POST /register уезжал
    // на /login до контроллера — без ошибок и без создания аккаунта.
    Route::get('register', fn () => redirect('/login'));

    Route::post('register', [RegisteredUserController::class, 'store'])
        ->middleware('throttle:auth-register')
        ->name('register');

    Route::get('login', [AuthenticatedSessionController::class, 'create'])
        ->name('login');

    Route::post('login', [AuthenticatedSessionController::class, 'store'])
        ->middleware('throttle:auth-login');

    Route::get('forgot-password', [PasswordResetLinkController::class, 'create'])
        ->name('password.request');

    Route::post('forgot-password', [PasswordResetLinkController::class, 'store'])
        ->middleware('throttle:auth-forgot')
        ->name('password.email');

    Route::get('reset-password/{token}', [NewPasswordController::class, 'create'])
        ->name('password.reset');

    Route::post('reset-password', [NewPasswordController::class, 'store'])
        ->middleware('throttle:auth-reset')
        ->name('password.store');
});

Route::middleware('auth')->group(function () {
    // Отдельной страницы verify-email нет: подтверждение — через
    // модалку в AuthenticatedLayout (кнопка шлёт ссылку, стаффу
    // модалка не показывается). Здесь только обработчик ссылки
    // из письма и повторная отправка по явной кнопке.
    Route::get('verify-email/{id}/{hash}', VerifyEmailController::class)
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    Route::post('email/verification-notification', [EmailVerificationNotificationController::class, 'store'])
        ->middleware('throttle:email-resend')
        ->name('verification.send');

    Route::get('confirm-password', [ConfirmablePasswordController::class, 'show'])
        ->name('password.confirm');

    Route::post('confirm-password', [ConfirmablePasswordController::class, 'store'])
        ->middleware('throttle:auth-confirm');

    Route::put('password', [PasswordController::class, 'update'])->name('password.update');

    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
        ->name('logout');
});
