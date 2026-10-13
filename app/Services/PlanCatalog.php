<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

/**
 * Каталог тарифов: типизированный доступ к config/plans.php.
 *
 * Единый источник правды о ценах и аудиториях планов. Лимиты пока живут
 * в константах User/DatingService (совместимость), здесь — цены, составы
 * аудиторий и сроки. Если конфиг недоступен — откатываемся на вшитые
 * дефолты, совпадающие с config/plans.php.
 */
class PlanCatalog
{
    /**
     * Дефолтные месячные цены (зеркало config/plans.php).
     *
     * @var array<string, float|null>
     */
    private const DEFAULT_MONTHLY = [
        'free' => null,
        'pro' => 3.99,
        'premium' => 7.99,
        'business' => 19.99,
    ];

    /**
     * Все планы каталога: по умолчанию из config/plans.php,
     * сверху — правки из админки (названия и описания).
     *
     * @return array<string, array{name:string,audience:string,tagline:string,prices:array<string,float|string|null>}>
     */
    public static function plans(): array
    {
        $configured = config('plans.plans');

        if (! is_array($configured) || $configured === []) {
            $configured = self::defaults();
        }

        $meta = self::metaOverrides();

        foreach ($meta as $planId => $fields) {
            if (! isset($configured[$planId])) {
                continue;
            }

            if (isset($fields['name']) && is_string($fields['name']) && $fields['name'] !== '') {
                $configured[$planId]['name'] = $fields['name'];
            }

            if (isset($fields['tagline']) && is_string($fields['tagline'])) {
                $configured[$planId]['tagline'] = $fields['tagline'];
            }
        }

        return $configured;
    }

    /**
     * Правки названий и описаний тарифов из админки (ключ {plan} → поля).
     *
     * @return array<string, array{name?:string,tagline?:string}>
     */
    public static function metaOverrides(): array
    {
        try {
            return Cache::remember('payments:plan_meta', 600, static function (): array {
                if (! Schema::hasTable('payment_items')) {
                    return [];
                }

                $rows = \App\Models\PaymentItem::where('kind', 'plan_meta')->get(['key', 'payload']);
                $out = [];

                foreach ($rows as $row) {
                    $planId = preg_replace('/\.meta$/', '', (string) $row->key);

                    if ($planId === '') {
                        continue;
                    }

                    $payload = is_array($row->payload) ? $row->payload : [];
                    $out[$planId] = [
                        'name' => $payload['name'] ?? null,
                        'tagline' => $payload['tagline'] ?? null,
                    ];
                }

                return $out;
            });
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Планы, доступные персонам (account_type=person).
     *
     * @return list<string>
     */
    public static function personPlans(): array
    {
        $list = config('plans.person_plans');

        if (is_array($list) && $list !== []) {
            return array_values($list);
        }

        return ['free', 'pro', 'premium'];
    }

    /**
     * Планы, доступные организациям (кабинет компании).
     *
     * @return list<string>
     */
    public static function organizationPlans(): array
    {
        $list = config('plans.organization_plans');

        if (is_array($list) && $list !== []) {
            return array_values($list);
        }

        return ['business'];
    }

    /**
     * Может ли персона держать этот план.
     *
     * @param string $plan free|pro|premium|business
     */
    public static function isPersonPlan(string $plan): bool
    {
        return in_array($plan, self::personPlans(), true);
    }

    /**
     * План ли это организаций (только кабинет компании).
     *
     * @param string $plan free|pro|premium|business
     */
    public static function isOrganizationPlan(string $plan): bool
    {
        return in_array($plan, self::organizationPlans(), true);
    }

    /**
     * Месячная цена плана в USD (null — бесплатно).
     *
     * Цена одна для всех стран. Сначала смотрим оверрайд из админки
     * «Тарифы» (payment_items), потом config/plans.php. Кэш сбрасывается
     * при сохранении цен.
     *
     * @param string $plan
     */
    public static function monthlyPrice(string $plan): ?float
    {
        $overrides = self::priceOverrides();
        $key = $plan.'.monthly';

        if (array_key_exists($key, $overrides) && $overrides[$key] !== null) {
            return $overrides[$key];
        }

        $plans = self::plans();
        $raw = $plans[$plan]['prices']['monthly'] ?? null;

        if ($raw === null) {
            return null;
        }

        return (float) $raw;
    }

    /**
     * Цена периода (yearly/weekly) с учётом оверрайдов админки.
     *
     * @param string $plan
     * @param string $period yearly|weekly
     */
    public static function periodPrice(string $plan, string $period): ?float
    {
        $override = self::priceOverrides()[$plan.'.'.$period] ?? null;

        if ($override !== null) {
            return $override;
        }

        $raw = self::plans()[$plan]['prices'][$period] ?? null;

        if ($raw === null) {
            return null;
        }

        return (float) $raw;
    }

    /**
     * Оверрайды цен из админки «Payments» (ключ {plan}.{period} → цена).
     *
     * Кэшируются на 10 минут; сброс — PlanCatalog::bustPriceCache()
     * при сохранении. Таблицы может не быть (миграция не прогнана) —
     * тогда молча отдаём пусто, цены берутся из конфига.
     *
     * @return array<string, float|null>
     */
    public static function priceOverrides(): array
    {
        try {
            return Cache::remember('payments:plan_prices', 600, static function (): array {
                if (! Schema::hasTable('payment_items')) {
                    return [];
                }

                $rows = \App\Models\PaymentItem::where('kind', 'plan_price')->get(['key', 'price']);
                $out = [];

                foreach ($rows as $row) {
                    $out[(string) $row->key] = $row->price === null ? null : (float) $row->price;
                }

                return $out;
            });
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Сбросить кэш цен и описаний (после сохранения в админке).
     */
    public static function bustPriceCache(): void
    {
        try {
            Cache::forget('payments:plan_prices');
            Cache::forget('payments:plan_meta');
        } catch (\Throwable) {
        }
    }

    /**
     * Возможности тарифа («что входит»): список из админки.
     *
     * @param string $plan free|pro|premium|business
     * @return list<array{key:string,name:string,description:string|null}>
     */
    public static function featuresForPlan(string $plan): array
    {
        try {
            if (! Schema::hasTable('payment_items')) {
                return [];
            }

            return \App\Models\PaymentItem::where('kind', 'feature')
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->filter(static function ($item) use ($plan): bool {
                    $payload = is_array($item->payload) ? $item->payload : [];

                    if (($payload['plan'] ?? null) === $plan) {
                        return true;
                    }

                    $plans = $payload['plans'] ?? null;

                    return is_array($plans) && in_array($plan, $plans, true);
                })
                ->map(static fn ($item): array => [
                    'key' => (string) $item->key,
                    'name' => (string) $item->name,
                    'description' => $item->description,
                ])
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Активные позиции витрины для каталога фронта (кроме цен планов).
     *
     * Цена для конкретного тарифа: сначала payload.prices_by_plan[plan],
     * потом базовая цена позиции. Поле price_for_plan посчитано под
     * переданный план (витрина умеет «свой ценник для PRO»).
     *
     * @param string|null $plan тариф зрителя (effectivePlan)
     * @return list<array<string, mixed>>
     */
    public static function showcaseItems(?string $plan = null): array
    {
        try {
            if (! Schema::hasTable('payment_items')) {
                return [];
            }

            return \App\Models\PaymentItem::where('is_active', true)
                ->where('kind', '!=', 'plan_price')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->map(static fn ($item): array => [
                    'key' => (string) $item->key,
                    'module' => (string) $item->module,
                    'kind' => (string) $item->kind,
                    'name' => (string) $item->name,
                    'description' => $item->description,
                    'price' => $item->price === null ? null : (float) $item->price,
                    'price_label' => $item->priceLabel(),
                    'prices_by_plan' => $item->payload['prices_by_plan'] ?? [],
                    'price_for_plan' => self::itemPrice($item, $plan),
                    'currency' => (string) ($item->currency ?? 'USD'),
                    'period' => $item->period,
                    'payload' => $item->payload ?? [],
                ])
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Цена позиции для тарифа: сначала prices_by_plan, потом базовая.
     *
     * @param \App\Models\PaymentItem $item позиция витрины
     * @param string|null $plan free|pro|premium|business (null — базовая)
     * @return float|null
     */
    public static function itemPrice(\App\Models\PaymentItem $item, ?string $plan = null): ?float
    {
        if ($plan !== null) {
            $byPlan = $item->payload['prices_by_plan'] ?? [];

            if (array_key_exists($plan, $byPlan) && $byPlan[$plan] !== null) {
                return (float) $byPlan[$plan];
            }
        }

        return $item->price === null ? null : (float) $item->price;
    }

    /**
     * Короткая подпись цены для кнопок и писем.
     *
     * @param string $plan
     * @return string «Бесплатно» либо «$3.99 / мес»
     */
    public static function priceLabel(string $plan): string
    {
        $price = self::monthlyPrice($plan);

        if ($price === null) {
            return 'Бесплатно';
        }

        $formatted = rtrim(rtrim(number_format($price, 2, '.', ''), '0'), '.');

        return '$'.$formatted.' / мес';
    }

    /**
     * Публичный каталог для фронта и бота: только нужная аудитории часть.
     *
     * Всё динамическое: названия и описания — из админки поверх конфига,
     * цены — итоговые (админка поверх конфига), возможности — списки
     * «что входит» из админки. Фронт ничего не придумывает сам.
     *
     * @param bool $isOrganization кабинет компании ли
     * @param string|null $plan тариф зрителя (цены витрины под него)
     * @return array{plans:list<array{id:string,name:string,price:string,tagline:string,prices:array<string,float|null>,features:list<array{key:string,name:string,description:string|null}}>>,items:list<array<string,mixed>>,period_days:int}
     */
    public static function forAudience(bool $isOrganization, ?string $plan = null): array
    {
        $allowed = $isOrganization
            ? array_merge(['free'], self::organizationPlans())
            : self::personPlans();

        $all = self::plans();
        $cards = [];

        foreach ($allowed as $id) {
            if (! isset($all[$id])) {
                continue;
            }

            $cards[] = [
                'id' => $id,
                'name' => (string) ($all[$id]['name'] ?? $id),
                'price' => self::priceLabel($id),
                'tagline' => (string) ($all[$id]['tagline'] ?? ''),
                'prices' => [
                    'monthly' => self::monthlyPrice($id),
                    'yearly' => self::periodPrice($id, 'yearly'),
                    'weekly' => self::periodPrice($id, 'weekly'),
                ],
                'features' => self::featuresForPlan($id),
            ];
        }

        return [
            'plans' => $cards,
            'items' => self::showcaseItems($plan),
            'period_days' => (int) (config('plans.period_days') ?? 30),
        ];
    }

    /**
     * Длительность платного периода, дней.
     */
    public static function periodDays(): int
    {
        return (int) (config('plans.period_days') ?? 30);
    }

    /**
     * Вшитые дефолты на случай недоступного конфига.
     *
     * @return array<string, array{name:string,audience:string,tagline:string,prices:array<string,float|string|null>}>
     */
    private static function defaults(): array
    {
        $names = [
            'free' => 'Free',
            'pro' => 'PRO',
            'premium' => 'Premium',
            'business' => 'Business',
        ];

        $taglines = [
            'free' => 'Чтобы жить районом и знакомиться рядом',
            'pro' => 'Для активных знакомств: тебя видят, тебе отвечают',
            'premium' => 'Максимум для знакомств: всё из PRO без ограничений',
            'business' => 'Только для организаций: кабинет компании',
        ];

        $out = [];

        foreach ($names as $id => $name) {
            $out[$id] = [
                'name' => $name,
                'audience' => $id === 'business' ? 'organizations' : 'users',
                'tagline' => $taglines[$id],
                'prices' => [
                    'monthly' => self::DEFAULT_MONTHLY[$id] ?? null,
                    'currency' => 'USD',
                ],
            ];
        }

        return $out;
    }
}
