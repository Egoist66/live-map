<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\CountryResolver;
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
     * Домашняя зона на регистрации не настраивается: всем выдаётся
     * Free-радиус 10 км по умолчанию, меняется позже в тарифе/настройках.
     * Геопозиция опциональна: без неё карта откроется по стране/городу.
     * ULove включён всем по умолчанию; любовные цели уводят в свайпы.
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
            'home_radius_km' => 'nullable|integer|min:1|max:10',
            'home_address' => 'nullable|string|max:255',
            'signup_goal' => 'required|in:love,flirt,friendship,chat,interests,neighbors',
        ]);

        CountryResolver::assertResidenceAllowed($request->input('country'), $request->input('country_code'), $request->input('home_lat'), $request->input('home_lng'));

        $signupGoal = $request->string('signup_goal')->toString();

        $datingGoal = $this->datingGoalFor($signupGoal);

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
            'home_radius_km' => 10,
            'signup_goal' => $signupGoal,
            'dating_enabled' => true,
            'dating_goal' => $datingGoal,
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect($this->landingFor($signupGoal));
    }

    /**
     * Пресет анкеты ULove из цели захода.
     *
     * @param string $signupGoal цель с формы регистрации
     * @return string|null dating_goal или null для карты
     */
    private function datingGoalFor(string $signupGoal): ?string
    {
        if ($signupGoal === 'neighbors') {
            return null;
        }

        return $signupGoal;
    }

    /**
     * Стартовый экран после регистрации по цели захода.
     *
     * @param string $signupGoal цель с формы регистрации
     * @return string URL свайпов для любовных целей, иначе карта
     */
    private function landingFor(string $signupGoal): string
    {
        if ($signupGoal === 'neighbors') {
            return route('map', absolute: false);
        }

        return route('swipes', absolute: false);
    }
}
