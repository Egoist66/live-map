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
     * Два сценария: персона (пол, цели, гео) и компания (реквизиты РБ:
     * форма, УНП, юрадрес — без дейтинга). Домашняя зона не настраивается:
     * всем выдаётся Free-радиус 10 км по умолчанию.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $accountType = $request->string('account_type')->toString();

        if (! in_array($accountType, ['person', 'business'], true)) {
            $accountType = $request->string('signup_goal')->toString() === 'business' ? 'business' : 'person';
        }

        $isBusiness = $accountType === 'business';

        $rules = [
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'birth_date' => 'nullable|date|before:today|after:1900-01-01',
            'country' => 'nullable|string|max:120',
            'country_code' => 'nullable|string|max:8',
            'home_city' => 'nullable|string|max:120',
            'home_lat' => 'nullable|numeric|between:-90,90',
            'home_lng' => 'nullable|numeric|between:-180,180',
            'home_radius_km' => 'nullable|integer|min:1|max:10',
            'home_address' => 'nullable|string|max:255',
            'signup_goal' => 'required|in:love,flirt,friendship,chat,interests,neighbors,business',
            'account_type' => 'nullable|in:person,business',
        ];

        if ($isBusiness) {
            $rules['gender'] = 'nullable|in:male,female,other';
            $rules['legal_form'] = 'required|string|in:ooo,ip,odo,zao,self_employed,craft,other';
            $rules['unp'] = 'required|string|regex:/^\d{9}$/';
            $rules['legal_address'] = 'required|string|min:4|max:255';
            $rules['phone'] = 'nullable|string|max:32';
        } else {
            $rules['gender'] = 'required|in:male,female,other';
        }

        $request->validate($rules, [
            'unp.regex' => 'УНП — строго 9 цифр',
            'legal_form.in' => 'Выберите форму собственности',
        ]);

        $country = $request->input('country');
        $countryCode = $request->input('country_code');

        if ($isBusiness && empty($country)) {
            $country = 'Беларусь';
            $countryCode = 'by';
        }

        CountryResolver::assertResidenceAllowed($country, $countryCode, $request->input('home_lat'), $request->input('home_lng'));

        $signupGoal = 'business';

        if (! $isBusiness) {
            $signupGoal = $request->string('signup_goal')->toString();
        }

        $datingGoal = $this->datingGoalFor($signupGoal);

        $defaultMode = $this->defaultModeFor($signupGoal);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'gender' => $request->input('gender'),
            'birth_date' => $request->birth_date,
            'country' => $country,
            'country_code' => $countryCode ? mb_strtolower(trim((string) $countryCode)) : null,
            'home_city' => $request->home_city,
            'home_lat' => $request->home_lat,
            'home_lng' => $request->home_lng,
            'home_radius_km' => 10,
            'signup_goal' => $signupGoal,
            'default_mode' => $defaultMode,
            'default_mode_set_at' => now(),
            'account_type' => $accountType,
            'dating_enabled' => ! $isBusiness,
            'dating_goal' => $datingGoal,
        ]);

        if ($isBusiness) {
            $business = app(\App\Services\BusinessService::class)->profileFor($user);

            $business->forceFill([
                'name' => $request->string('name')->toString(),
                'legal_form' => $request->string('legal_form')->toString(),
                'unp' => $request->string('unp')->toString(),
                'legal_address' => $request->string('legal_address')->toString(),
                'phone' => $request->input('phone'),
                'address' => $request->input('home_city'),
            ])->save();
        }

        event(new Registered($user));

        Auth::login($user);

        if ($isBusiness) {
            return redirect(route('business.onboarding', absolute: false));
        }

        return redirect($this->landingFor($defaultMode));
    }

    /**
     * Пресет анкеты ULove из цели захода.
     *
     * @param string $signupGoal цель с формы регистрации
     * @return string|null dating_goal или null для карты
     */
    private function datingGoalFor(string $signupGoal): ?string
    {
        if ($signupGoal === 'neighbors' || $signupGoal === 'business') {
            return null;
        }

        return $signupGoal;
    }

    /**
     * Стартовый режим из цели захода.
     *
     * @param string $signupGoal цель с формы регистрации
     * @return string ulove для знакомств, upin для карты
     */
    private function defaultModeFor(string $signupGoal): string
    {
        if ($signupGoal === 'neighbors') {
            return 'upin';
        }

        return 'ulove';
    }

    /**
     * Стартовый экран после регистрации по режиму.
     *
     * @param string $defaultMode ulove|upin
     * @return string URL свайпов для ULove, иначе карта
     */
    private function landingFor(string $defaultMode): string
    {
        if ($defaultMode === 'upin') {
            return route('map', absolute: false);
        }

        return route('swipes', absolute: false);
    }
}
