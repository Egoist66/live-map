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
 *
 * Список возможностей — полное зеркало запасных описаний фронта
 * (resources/js/composables/usePlanDetails.ts, PLAN_DETAILS): названия
 * совпадают строка в строку, поэтому модалка «Что даёт тариф» не дублирует
 * живые строки из админки запасными. Добавил строку во фронт — добавь сюда
 * с тем же названием, иначе она появится в модалке дважды.
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

        PaymentItem::whereIn('key', $this->prunedKeys())->delete();
    }

    /**
     * Ключи, убранные из стартового набора: их строки удаляются,
     * чтобы не висели в админке вечным мусором.
     *
     * @return list<string>
     */
    private function prunedKeys(): array
    {
        return [
            'feat_biz_stats',
        ];
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
     * Полное зеркало запасных описаний фронта (usePlanDetails.ts):
     * названия совпадают строка в строку, чтобы модалка «Что даёт тариф»
     * не показывала живую строку из админки и запасную дублем.
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
            ?string $description,
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
            // Free: знакомства.
            $make('feat_free_swipes', 'free', 'ulove', 'Безлимитные свайпы рядом', 'Смотри анкеты соседей без ограничений.', 101),
            $make('feat_free_match_only', 'free', 'ulove', 'Пишут только мэтчи — бесплатно', null, 102),
            $make('feat_free_messages', 'free', 'ulove', 'Сообщения без мэтча — 3 в месяц', 'Можно написать первым — 3 раза в месяц.', 103),
            $make('feat_free_favorites', 'free', 'ulove', 'Избранное — до 3 анкет', null, 104),
            $make('feat_free_likers', 'free', 'ulove', 'Кто тебя лайкнул: счётчик и базовая статистика', null, 105),
            // Free: карта и профиль.
            $make('feat_free_pins', 'free', 'upin', '3 живых пина одновременно, жизнь пина — 4 часа', 'Точки на карте района, видны соседям.', 106),
            $make('feat_free_radius', 'free', 'upin', 'Радиус пинов и домашней зоны — до 10 км', null, 107),
            $make('feat_free_reactions', 'free', 'upin', 'Реакции продлевают жизнь пина (+1 час)', null, 108),
            $make('feat_free_gallery', 'free', 'general', 'Галерея — 5 фото, скрытых друзей — 1', 'Пять фотографий в профиле.', 109),
            $make('feat_free_blur', 'free', 'upin', 'Размытие точки: точное место, 300 м, 1 км', null, 110),
            $make('feat_free_districts', 'free', 'districts', 'UDistrict — 2 своих района-заливки', null, 111),
            $make('feat_free_anon', 'free', 'uflow', 'Анонимные посты в UFlow — до 2', null, 112),
            $make('feat_free_chat_pins', 'free', 'general', 'Закрепы чатов — без лимита, важные всегда сверху как в Telegram', null, 113),
            $make('feat_free_export', 'free', 'general', 'Выгрузка любой переписки в аккуратный HTML', null, 114),
            // PRO: знакомства.
            $make('feat_pro_hide', 'pro', 'ulove', 'Скрытие имени и возраста в анкете', null, 201),
            $make('feat_pro_secret_like', 'pro', 'ulove', 'Инкогнито-лайк «Тайный поклонник»', null, 202),
            $make('feat_pro_swipe_radius', 'pro', 'ulove', 'Радиус свайпов — безлимит', null, 203),
            $make('feat_pro_messages', 'pro', 'ulove', 'Сообщения без мэтча — 20 в месяц', 'Пиши первым в 6 раз чаще, чем на бесплатном.', 204),
            $make('feat_pro_favorites', 'pro', 'ulove', 'Избранное — до 10 анкет', null, 205),
            $make('feat_pro_likers', 'pro', 'ulove', 'Кто вас лайкает: интересы, возраст, пол', 'Интересы, возраст и пол тех, кому ты понравилась.', 206),
            $make('feat_pro_guests', 'pro', 'ulove', 'Уведомления «кто заходил в мой профиль»', null, 207),
            $make('feat_pro_super', 'pro', 'ulove', 'Суперлайки — 5 в день, возвраты свайпов — безлимит', null, 208),
            // PRO: карта и профиль.
            $make('feat_pro_pins', 'pro', 'upin', 'Безлимит пинов, жизнь пина — 12 часов', 'Сколько угодно точек, живут в 3 раза дольше.', 209),
            $make('feat_pro_pin_radius', 'pro', 'upin', 'Радиус пинов и домашней зоны — до 15 км', null, 210),
            $make('feat_pro_categories', 'pro', 'upin', 'Свои категории пинов с иконкой и цветом', null, 211),
            $make('feat_pro_home', 'pro', 'upin', 'Точная точка дома и размытие до 5 км', null, 212),
            $make('feat_pro_invisible', 'pro', 'general', 'Режим «Невидимка» — тебя не видно в онлайне', 'Тебя не видно в онлайне, лайки — анонимно.', 213),
            $make('feat_pro_anon_likes', 'pro', 'general', 'Анонимные лайки фото — тебя видят как «Тайного поклонника»', null, 214),
            $make('feat_pro_gallery', 'pro', 'general', 'Галерея — 10 фото, скрытых друзей — до 3', 'Вдвое больше места под фотографии.', 215),
            $make('feat_pro_districts', 'pro', 'districts', 'UDistrict — до 5 своих районов', null, 216),
            $make('feat_pro_anon', 'pro', 'uflow', 'Анонимные посты в UFlow — до 5', null, 217),
            $make('feat_pro_export', 'pro', 'general', 'Выгрузка любой переписки в аккуратный HTML', null, 218),
            // Premium: знакомства.
            $make('feat_premium_all', 'premium', 'ulove', 'Всё из PRO: инкогнито, скрытие имени и возраста', 'Инкогнито, скрытие имени и возраста, сбросы.', 301),
            $make('feat_premium_reset', 'premium', 'ulove', 'Безлимитный сброс просмотренных свайпов', null, 302),
            $make('feat_premium_fav', 'premium', 'ulove', 'Избранное — до 15 анкет', 'Сохраняй больше людей, ничего не потеряется.', 303),
            $make('feat_premium_guests', 'premium', 'ulove', 'Гости профиля: кто заходил, анкета целиком, кнопка «Написать»', 'Видно, кто заходил, — можно сразу написать.', 304),
            $make('feat_premium_csv', 'premium', 'ulove', 'Уведомления о гостях плюс выгрузка статистики в CSV', null, 305),
            // Premium: карта и профиль.
            $make('feat_premium_pins', 'premium', 'upin', 'Безлимит пинов без срока жизни', 'Точки живут пока нужны, видно весь город.', 306),
            $make('feat_premium_radius', 'premium', 'upin', 'Радиус пинов и домашней зоны — до 50 км', null, 307),
            $make('feat_premium_invisible', 'premium', 'general', 'Режим «Невидимка» — тебя не видно в онлайне', null, 308),
            $make('feat_premium_gallery', 'premium', 'general', 'Галерея — 15 фото, скрытые друзья — без лимита', null, 309),
            $make('feat_premium_blur', 'premium', 'upin', 'Размытие точки до 5 км', null, 310),
            $make('feat_premium_districts', 'premium', 'districts', 'UDistrict — до 15 своих районов', null, 311),
            $make('feat_premium_export', 'premium', 'general', 'Выгрузка любой переписки в аккуратный HTML', null, 312),
            // Business: кабинет и карта.
            $make('feat_biz_profile', 'business', 'business', 'Бизнес-профиль: название, адрес, телефон, сайт, часы работы', 'Название, адрес, телефон, часы работы и бейдж.', 401),
            $make('feat_biz_badge', 'business', 'business', 'Бейдж организации и витрина в поиске', null, 402),
            $make('feat_biz_pin', 'business', 'upin', 'Безлимит пинов без срока жизни, радиус — до 50 км', 'Точки организации с радиусом до 50 км.', 403),
            $make('feat_biz_invisible', 'business', 'general', 'Режим «Невидимка» — тебя не видно в онлайне', null, 404),
            $make('feat_biz_gallery', 'business', 'general', 'Галерея — 15 фото, скрытые друзья — без лимита', null, 405),
            $make('feat_biz_blur', 'business', 'upin', 'Размытие точки до 5 км', null, 406),
            $make('feat_biz_districts', 'business', 'districts', 'UDistrict — до 15 своих районов', null, 407),
            $make('feat_biz_export', 'business', 'general', 'Выгрузка любой переписки в аккуратный HTML', null, 408),
        ];
    }
}
