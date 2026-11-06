<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /**
     * Display the password reset link request view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/ForgotPassword', [
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        // Honeypot с фейковым успехом: бот думает, что письмо ушло,
        // реальная рассылка не запускается, пользователя не перечисляем.
        if (\App\Services\TurnstileService::honeypotFilled($request->input('website'))) {
            \Illuminate\Support\Facades\Log::warning('bot blocked', [
                'reason' => 'honeypot',
                'ip' => $request->ip(),
                'path' => 'forgot-password',
                'ua' => mb_substr((string) $request->userAgent(), 0, 256),
            ]);

            return back()->with('status', __('passwords.sent'));
        }

        $request->validate([
            'email' => 'required|email',
            'website' => 'nullable|string|max:255',
            'captcha_token' => \App\Rules\ValidTurnstile::rules($request),
        ], [
            'captcha_token.required' => \App\Rules\ValidTurnstile::emptyMessage(),
        ]);

        // We will send the password reset link to this user. Once we have attempted
        // to send the link, we will examine the response then see the message we
        // need to show to the user. Finally, we'll send out a proper response.
        $status = Password::sendResetLink(
            $request->only('email')
        );

        if ($status == Password::RESET_LINK_SENT) {
            return back()->with('status', __($status));
        }

        throw ValidationException::withMessages([
            'email' => [trans($status)],
        ]);
    }
}
