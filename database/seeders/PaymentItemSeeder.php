<?php

namespace Database\Seeders;

use App\Models\PaymentItem;
use Illuminate\Database\Seeder;

/**
 * Стартовая витрина магазина: пакеты кредитов, разовые возможности и реклама.
 *
 * Идемпотентен (updateOrCreate по key): повторный запуск обновляет строки.
 * Цены тарифов здесь не хранятся — они задаются в разделе «Тарифы» выше.
 * Кредиты и реклама выключены (is_active=false) до подключения оплаты:
 * витрина готова, а продать раньше времени нельзя.
 * Возможности тарифов (что входит в Free/PRO/Premium/Business) включены
 * сразу: они показываются внутри карточки каждого тарифа.
 */
class PaymentItemSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->rows() as $row) {
            PaymentItem::updateOrCreate(
                ['key' => $row['key']],
                $row
            );
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function rows(): array
    {
        return [
            [
                'key' => 'credits_20',
                'module' => 'general',
                'kind' => 'credit_pack',
                'name' => '20 кредитов',
                'description' => 'Попробовать: пара суперлайков или возврат свайпа.',
                'price' => 1.99,
                'currency' => 'USD',
                'period' => 'once',
                'payload' => ['credits' => 20],
                'is_active' => false,
                'sort_order' => 10,
            ],
            [
                'key' => 'credits_60',
                'module' => 'general',
                'kind' => 'credit_pack',
                'name' => '60 кредитов · Хит',
                'description' => 'Самый ходовой пакет: бусты, суперлайки, ТОП.',
                'price' => 4.99,
                'currency' => 'USD',
                'period' => 'once',
                'payload' => ['credits' => 60],
                'is_active' => false,
                'sort_order' => 20,
            ],
            [
                'key' => 'credits_150',
                'module' => 'general',
                'kind' => 'credit_pack',
                'name' => '150 кредитов · Выгодно',
                'description' => 'Запас надолго: ~10 суперлайков и 4 буста.',
                'price' => 9.99,
                'currency' => 'USD',
                'period' => 'once',
                'payload' => ['credits' => 150],
                'is_active' => false,
                'sort_order' => 30,
            ],
            [
                'key' => 'superlike_1',
                'module' => 'ulove',
                'kind' => 'feature',
                'name' => 'Суперлайк',
                'description' => 'Разовое: тебя точно заметят. 15 кредитов.',
                'price' => 1.50,
                'currency' => 'USD',
                'period' => 'once',
                'payload' => ['credits_cost' => 15],
                'is_active' => false,
                'sort_order' => 40,
            ],
            [
                'key' => 'boost_1h',
                'module' => 'ulove',
                'kind' => 'feature',
                'name' => 'Буст анкеты · 1 час',
                'description' => 'Час сверху ленты. 30 кредитов.',
                'price' => 3.00,
                'currency' => 'USD',
                'period' => 'once',
                'payload' => ['credits_cost' => 30],
                'is_active' => false,
                'sort_order' => 50,
            ],
            [
                'key' => 'pin_top_24h',
                'module' => 'upin',
                'kind' => 'feature',
                'name' => 'Пин в ТОП · 24 часа',
                'description' => 'Пин сверху карты района. 25 кредитов.',
                'price' => 2.50,
                'currency' => 'USD',
                'period' => 'once',
                'payload' => ['credits_cost' => 25],
                'is_active' => false,
                'sort_order' => 60,
            ],
            [
                'key' => 'ad_promo_pin',
                'module' => 'business',
                'kind' => 'ad',
                'name' => 'Рекламный пин · 7 дней',
                'description' => 'Пин компании в радиусе + статистика просмотров.',
                'price' => 9.99,
                'currency' => 'USD',
                'period' => 'once',
                'payload' => ['days' => 7],
                'is_active' => false,
                'sort_order' => 70,
            ],
            [
                'key' => 'ad_zone_push',
                'module' => 'business',
                'kind' => 'ad',
                'name' => 'Пуш по району',
                'description' => 'Рассылка подписчикам зоны. Цена от охвата.',
                'price' => 14.99,
                'currency' => 'USD',
                'period' => 'once',
                'payload' => [],
                'is_active' => false,
                'sort_order' => 80,
            ],
            [
                'key' => 'ad_coupon',
                'module' => 'business',
                'kind' => 'ad',
                'name' => 'Купон с кнопкой «Маршрут»',
                'description' => 'Акция приводит ногами: клиент строит маршрут из пина.',
                'price' => 4.99,
                'currency' => 'USD',
                'period' => 'once',
                'payload' => [],
                'is_active' => false,
                'sort_order' => 90,
            ],
            ...$this->planFeatures(),
        ];
    }

    /**
     * Возможности тарифов: что входит в каждый тариф.
     *
     * Цена пустая — возможность уже включена в тариф, отдельно не продаётся.
     * Привязка к тарифу лежит в payload.plan: по ней админка показывает
     * возможность внутри карточки тарифа (раскрывается по клику).
     *
     * @return list<array<string, mixed>>
     */
    private function planFeatures(): array
    {
        $make = static function (
            string $key,
            string $plan,
            string $module,
            string $name,
            string $description,
            int $sort
        ): array {
            return [
                'key' => $key,
                'module' => $module,
                'kind' => 'feature',
                'name' => $name,
                'description' => $description,
                'price' => null,
                'currency' => 'USD',
                'period' => 'once',
                'payload' => ['plan' => $plan],
                'is_active' => true,
                'sort_order' => $sort,
            ];
        };

        return [
            $make('feat_free_swipes', 'free', 'ulove', 'Безлимитные свайпы рядом', 'Смотри анкеты соседей без ограничений.', 101),
            $make('feat_free_messages', 'free', 'ulove', '3 сообщения без совпадения', 'Можно написать первым — 3 раза в месяц.', 102),
            $make('feat_free_pins', 'free', 'upin', '3 живых пина на 4 часа', 'Точки на карте района, видны соседям.', 103),
            $make('feat_free_gallery', 'free', 'general', 'Галерея: 5 фото', 'Пять фотографий в профиле.', 104),
            $make('feat_pro_likers', 'pro', 'ulove', 'Видно, кто тебя лайкнул', 'Интересы, возраст и пол тех, кому ты понравилась.', 111),
            $make('feat_pro_invisible', 'pro', 'general', 'Невидимка и тайные лайки', 'Тебя не видно в онлайне, лайки — анонимно.', 112),
            $make('feat_pro_messages', 'pro', 'ulove', '20 сообщений без совпадения', 'Пиши первым в 6 раз чаще, чем на бесплатном.', 113),
            $make('feat_pro_pins', 'pro', 'upin', 'Пины без лимита на 12 часов', 'Сколько угодно точек, живут в 3 раза дольше.', 114),
            $make('feat_pro_gallery', 'pro', 'general', 'Галерея: 10 фото', 'Вдвое больше места под фотографии.', 115),
            $make('feat_premium_all', 'premium', 'ulove', 'Всё из PRO без ограничений', 'Инкогнито, скрытие имени и возраста, сбросы.', 121),
            $make('feat_premium_guests', 'premium', 'ulove', 'Гости профиля с анкетами', 'Видно, кто заходил, — можно сразу написать.', 122),
            $make('feat_premium_fav', 'premium', 'ulove', 'Избранное до 15 анкет', 'Сохраняй больше людей, ничего не потеряется.', 123),
            $make('feat_premium_pins', 'premium', 'upin', 'Пины без срока, радиус 50 км', 'Точки живут пока нужны, видно весь город.', 124),
            $make('feat_biz_profile', 'business', 'business', 'Кабинет компании', 'Название, адрес, телефон, часы работы и бейдж.', 131),
            $make('feat_biz_pin', 'business', 'upin', 'Пины компании без срока', 'Точки организации с радиусом до 50 км.', 132),
            $make('feat_biz_stats', 'business', 'business', 'Статистика просмотров', 'Сколько людей увидели пин и построили маршрут.', 133),
        ];
    }
}
