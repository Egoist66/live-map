<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Платная позиция витрины: цена плана, пакет кредитов, фишка, реклама.
 *
 * Правится из админки «Payments» и сразу влияет на приложение:
 * - kind=plan_price, key={plan}.{period} — оверрайд цены из config/plans.php
 *   (читает PlanCatalog, отдаёт каталог фронта и бот);
 * - остальные kind — будущая витрина кредитов и поштучных товаров
 *   (активные отдаются в GET /api/subscription/plans как items).
 *
 * @property int $id
 * @property string $key уникальный ключ (напр. pro.monthly, credits_60)
 * @property string $module модуль: ulove|upin|uflow|districts|business|general
 * @property string $kind plan_price|credit_pack|feature|ad
 * @property string $name название для витрины
 * @property string|null $description пояснение для витрины
 * @property float|null $price цена (null — бесплатно)
 * @property string $currency валюта
 * @property string|null $period once|week|month|year
 * @property array|null $payload доп. данные (кол-во кредитов, план и т.д.)
 * @property bool $is_active показывать ли в витрине
 * @property int $sort_order порядок в таблице
 */
class PaymentItem extends Model
{
    protected $fillable = [
        'key',
        'module',
        'kind',
        'name',
        'description',
        'price',
        'currency',
        'period',
        'payload',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'price' => 'float',
        'payload' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Виды позиций витрины.
     *
     * @return list<string>
     */
    public static function kinds(): array
    {
        return ['plan_price', 'credit_pack', 'feature', 'ad'];
    }

    /**
     * Модули позиций (зеркало AppModule на фронте + general).
     *
     * @return list<string>
     */
    public static function modules(): array
    {
        return ['general', 'ulove', 'upin', 'uflow', 'districts', 'business'];
    }

    /**
     * Короткая подпись цены для витрины и админки.
     *
     * @return string «Бесплатно» либо «$3.99 / мес»
     */
    public function priceLabel(): string
    {
        if ($this->price === null) {
            return 'Бесплатно';
        }

        $formatted = rtrim(rtrim(number_format((float) $this->price, 2, '.', ''), '0'), '.');
        $suffix = match ($this->period) {
            'week' => ' / нед',
            'month' => ' / мес',
            'year' => ' / год',
            default => '',
        };

        return '$'.$formatted.$suffix;
    }
}
