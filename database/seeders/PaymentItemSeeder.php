<?php

namespace Database\Seeders;

use App\Models\PaymentItem;
use Illuminate\Database\Seeder;

/**
 * Стартовая витрина Payments: пакеты кредитов и реклама по модулям.
 *
 * Идемпотентен (updateOrCreate по key): повторный запуск обновляет строки.
 * Цены планов здесь НЕ сидим — они живут в config/plans.php, а оверрайды
 * правятся в админке «Payments» (kind=plan_price). Кредиты и реклама
 * выключены (is_active=false) до подключения шлюза: витрина готова,
 * продать раньше времени нельзя.
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
        ];
    }
}
