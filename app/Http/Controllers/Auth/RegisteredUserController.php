<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'gender' => 'required|in:male,female,other',
            'birth_date' => 'nullable|date|before:today|after:1900-01-01',
            'country' => 'nullable|string|max:120',
            'country_code' => 'nullable|string|max:8',
            'home_city' => 'nullable|string|max:120',
            'home_lat' => 'nullable|numeric|between:-90,90',
            'home_lng' => 'nullable|numeric|between:-180,180',
            'home_radius_km' => 'nullable|integer|min:1|max:5',
            'home_address' => 'nullable|string|max:255',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'gender' => $request->gender,
            'birth_date' => $request->birth_date,
            'country' => $request->country,
            'country_code' => $request->country_code ? mb_strtolower(trim((string) $request->country_code)) : null,
            'home_city' => $request->home_city,
            'home_lat' => $request->home_lat,
            'home_lng' => $request->home_lng,
            'home_radius_km' => min(5, max(1, (int) ($request->home_radius_km ?? 5))),
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}
