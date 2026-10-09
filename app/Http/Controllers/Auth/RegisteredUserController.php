<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\CountryResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;

class RegisteredUserController extends Controller
{
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
            'landing_tab' => 'nullable|in:ulove,upin,business',
            'enabled_modules' => 'nullable|array',
            'enabled_modules.*' => 'nullable|string|in:ulove,upin,uflow,districts,business',
        ];

        if ($isBusiness) {
            $rules['gender'] = 'nullable|in:male,female,other';
            $rules['legal_form'] = 'required|string|in:ooo,ip,odo,zao,self_employed,craft,other';
            $rules['unp'] = 'required|string|regex:/^\d{9}$/';
            $rules['legal_address'] = 'required|string|min:4|max:255';
            $rules['phone'] = 'nullable|string|max:32';
            $rules['brand'] = 'nullable|string|max:255';
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

        $defaultMode = $this->defaultModeFor($signupGoal, $request->input('landing_tab'));
        $enabledModules = $this->enabledModulesFor($signupGoal, $request->input('landing_tab'), $request->input('enabled_modules'));

        $userPayload = [
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
            'enabled_modules' => $enabledModules,
            'account_type' => $accountType,
            'dating_enabled' => ! $isBusiness,
            'dating_goal' => $datingGoal,
        ];

        if ($isBusiness) {
            $userPayload['role'] = 'organization';
            $userPayload['plan'] = 'business';
            $userPayload['plan_expires_at'] = now()->addDays(30);
        }

        $user = User::create($userPayload);

        \App\Services\AppModulesWelcomeNews::ensureDelivered($user);

        if ($isBusiness) {
            $business = app(\App\Services\BusinessService::class)->profileFor($user);

            $business->forceFill([
                'name' => $request->string('name')->toString(),
                'brand' => $request->input('brand'),
                'legal_form' => $request->string('legal_form')->toString(),
                'unp' => $request->string('unp')->toString(),
                'legal_address' => $request->string('legal_address')->toString(),
                'phone' => $request->input('phone'),
                'address' => $request->input('home_city'),
            ])->save();
        }

        // Письмо подтверждения НЕ отправляем автоматически: пользователь
        // сам нажимает «Подтвердить почту» в модалке и получает ссылку.
        // Так нет ни спама, ни случайных 429 на повторной отправке.
        Auth::login($user);

        \App\Services\LoginDeviceGuard::handleLogin($user, $request, 'register');

        if ($isBusiness) {
            return redirect(route('cabinet.onboarding', absolute: false));
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
     * Стартовый режим нового пользователя.
     *
     * По ТЗ механика запоминания таба убрана: все персоны стартуют
     * с ULove. Карта с пинами — бонус для общения и встреч, она
     * включается вторым модулем, а не стартовым экраном.
     *
     * @param string $signupGoal цель с формы регистрации
     * @param mixed $landingTab таб лендинга (игнорируется, оставлен для совместимости)
     * @return string всегда ulove для персон
     */
    private function defaultModeFor(string $signupGoal, mixed $landingTab): string
    {
        return 'ulove';
    }

    /**
     * Модули новичка: только ULove.
     *
     * Остальные разделы выдаются отдельными патчами: админ включает
     * их глобально, после чего пользователь видит тумблеры в настройках.
     * Так клиент не тянет чанки карты/ленты/районов зря.
     *
     * @param string $signupGoal цель с формы регистрации
     * @param mixed $landingTab таб лендинга (игнорируется)
     * @param mixed $requested явный список модулей с фронта (игнорируется)
     * @return string[] всегда [ulove] для персон
     */
    private function enabledModulesFor(string $signupGoal, mixed $landingTab, mixed $requested): array
    {
        if ($signupGoal === 'business') {
            return ['business'];
        }

        return ['ulove'];
    }

    /**
     * Стартовый экран после регистрации.
     *
     * Всегда свайпы ULove: карта — бонус, а не стартовый экран.
     *
     * @param string $defaultMode режим (игнорируется)
     * @return string URL свайпов ULove
     */
    private function landingFor(string $defaultMode): string
    {
        return route('swipes', absolute: false);
    }
}
