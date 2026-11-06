<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AppSettings;
use App\Services\CountryResolver;
use App\Services\HomeLocationService;
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
        // Honeypot: поле `website` скрыто CSS — человек его не заполняет.
        // Бота режем generic-ошибкой без подсказок, что именно сработало.
        if (\App\Services\TurnstileService::honeypotFilled($request->input('website'))) {
            \Illuminate\Support\Facades\Log::warning('bot blocked', [
                'reason' => 'honeypot',
                'ip' => $request->ip(),
                'path' => 'register',
                'ua' => mb_substr((string) $request->userAgent(), 0, 256),
            ]);

            throw ValidationException::withMessages([
                'email' => 'Подозрительная активность. Попробуйте позже.',
            ]);
        }

        $accountType = $request->string('account_type')->toString();

        if (! in_array($accountType, ['person', 'business'], true)) {
            $accountType = $request->string('signup_goal')->toString() === 'business' ? 'business' : 'person';
        }

        $isBusiness = $accountType === 'business';

        $rules = [
            'name' => ['required', 'string', 'max:255', new \App\Rules\NoProfanity(), new \App\Rules\NoContactInfo()],
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
            'website' => 'nullable|string|max:255',
            'captcha_token' => \App\Rules\ValidTurnstile::rules($request),
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
            // Для физлиц дата рождения обязательна и строго 18+ —
            // модалка-гейт в свайпах у таких аккаунтов уже не всплывает.
            $rules['birth_date'] = 'required|date|after:1900-01-01|before_or_equal:'.$this->adultMaxBirthDate();
        }

        $request->validate($rules, [
            'unp.regex' => 'УНП — строго 9 цифр',
            'legal_form.in' => 'Выберите форму собственности',
            'captcha_token.required' => \App\Rules\ValidTurnstile::emptyMessage(),
            'birth_date.required' => 'Укажи дату рождения — регистрация доступна с 18 лет',
            'birth_date.before_or_equal' => 'Свайпы и мэтчи — строго с 18 лет',
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

        app(HomeLocationService::class)->ensureCoordinates($user);

        \App\Services\AdminNotifier::newUserRegistered($user, 'web');

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
     * Максимальная дата рождения для регистрации: сегодня минус 18 лет.
     *
     * @return string дата в формате Y-m-d
     */
    private function adultMaxBirthDate(): string
    {
        return now()->subYears(18)->toDateString();
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
     * Модули новичка: ULove + всё глобально включённое.
     *
     * Выпущенные разделы новичок получает сразу активированными:
     * тумблеры в настройках «Приложение» уже включены. Стартовый
     * экран при этом всегда ULove (первый в глобальном наборе).
     * Так клиент не тянет чанки выключенных разделов зря.
     *
     * @param string $signupGoal цель с формы регистрации
     * @param mixed $landingTab таб лендинга (игнорируется)
     * @param mixed $requested явный список модулей с фронта (игнорируется)
     * @return string[] [ulove, ...выпущенное] для персон
     */
    private function enabledModulesFor(string $signupGoal, mixed $landingTab, mixed $requested): array
    {
        if ($signupGoal === 'business') {
            return ['business'];
        }

        return AppSettings::globalModules();
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
