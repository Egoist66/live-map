<?php

namespace App\Http\Controllers;

use App\Models\PaymentItem;
use App\Services\PlanCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Админка «Payments»: витрина цен и точка подключения оплат.
 *
 * Только полные админы (роут в admin-группе). Два инструмента:
 * - цены планов (оверрайды config/plans.php через payment_items
 *   kind=plan_price): правишь — PlanCatalog, фронт и бот подхватывают сами;
 * - таблица позиций (пакеты кредитов, фишки, реклама по модулям):
 *   CRUD витрины, активные отдаются в GET /api/subscription/plans.
 *
 * Шлюз оплаты ещё не подключён: overview отдаёт статусы-заглушки,
 * реальная интеграция (Stripe + местный эквайринг) встанет сюда же.
 */
class AdminPaymentsController extends Controller
{
    /**
     * Сводка: эффективные цены планов, статусы шлюзов, счётчики витрины.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function overview(): JsonResponse
    {
        $plans = [];

        foreach (['free', 'pro', 'premium', 'business'] as $plan) {
            $plans[] = [
                'id' => $plan,
                'name' => PlanCatalog::plans()[$plan]['name'] ?? $plan,
                'prices' => [
                    'monthly' => PlanCatalog::monthlyPrice($plan),
                    'regional_monthly' => PlanCatalog::monthlyPrice($plan, true),
                    'yearly' => PlanCatalog::periodPrice($plan, 'yearly'),
                    'weekly' => PlanCatalog::periodPrice($plan, 'weekly'),
                ],
            ];
        }

        return response()->json([
            'plans' => $plans,
            'gateways' => [
                ['id' => 'stripe', 'label' => 'Stripe (мир, Apple/Google Pay)', 'status' => 'not_connected'],
                ['id' => 'local', 'label' => 'МИР / СБП / ЕРИП (BY/RU)', 'status' => 'not_connected'],
            ],
            'gateway_note' => 'Шлюз в разработке: платные тарифы выдаются вручную после перевода (см. SubscriptionController::PAYMENT_NOTE). Позиции ниже — витрина будущего магазина.',
            'items_total' => PaymentItem::count(),
            'items_active' => PaymentItem::where('is_active', true)->count(),
        ]);
    }

    /**
     * Вся витрина для таблицы (включая выключенные).
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function items(): JsonResponse
    {
        $rows = PaymentItem::orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['items' => $rows]);
    }

    /**
     * Массово сохранить цены планов (оверрайды конфига).
     *
     * Удаление оверрайда = вернуть цену из config/plans.php:
     * передай price=null. После сохранения кэш цен сбрасывается,
     * фронт и бот видят новые цены без редеплоя.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function savePlanPrices(Request $request): JsonResponse
    {
        $data = $request->validate([
            'prices' => ['required', 'array', 'min:1'],
            'prices.*.plan' => ['required', 'string', 'in:free,pro,premium,business'],
            'prices.*.period' => ['required', 'string', 'in:monthly,regional_monthly,yearly,weekly'],
            'prices.*.price' => ['nullable', 'numeric', 'min:0', 'max:9999'],
        ]);

        foreach ($data['prices'] as $row) {
            $key = $row['plan'].'.'.$row['period'];

            PaymentItem::updateOrCreate(
                ['key' => $key],
                [
                    'module' => $row['plan'] === 'business' ? 'business' : 'general',
                    'kind' => 'plan_price',
                    'name' => 'Цена '.($row['plan']).' / '.$row['period'],
                    'price' => $row['price'],
                    'currency' => 'USD',
                    'period' => $this->shortPeriod($row['period']),
                    'is_active' => true,
                ]
            );
        }

        PlanCatalog::bustPriceCache();

        return response()->json(['saved' => count($data['prices'])]);
    }

    /**
     * Добавить позицию витрины (кредиты, фишка, реклама).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateItem($request);

        $item = PaymentItem::create($data);

        return response()->json(['item' => $item], 201);
    }

    /**
     * Обновить позицию витрины.
     *
     * @param Request $request
     * @param PaymentItem $item
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, PaymentItem $item): JsonResponse
    {
        // Цены планов правятся только через savePlanPrices (там сброс кэша).
        if ($item->kind === 'plan_price') {
            return response()->json(['message' => 'Цены планов меняются блоком «Цены тарифов» выше.'], 422);
        }

        $item->update($this->validateItem($request));

        return response()->json(['item' => $item->fresh()]);
    }

    /**
     * Удалить позицию витрины.
     *
     * @param PaymentItem $item
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(PaymentItem $item): JsonResponse
    {
        if ($item->kind === 'plan_price') {
            return response()->json(['message' => 'Оверрайд цены плана сбрасывается ценой null в блоке «Цены тарифов».'], 422);
        }

        $item->delete();

        return response()->json(['deleted' => true]);
    }

    /**
     * Выгрузка всего ценообразования в Excel.
     *
     * Лист «Тарифы»: эффективные цены по периодам + откуда взяты
     * (конфиг или оверрайд из админки). Лист «Витрина»: все позиции
     * с ценами по тарифам и флагами. Для финансов и ревизии цен
     * без доступа в админку.
     *
     * @return \Symfony\Component\HttpFoundation\StreamedResponse
     */
    public function export()
    {
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $spreadsheet->getProperties()
            ->setCreator('UPin Admin')
            ->setTitle('Ценообразование');

        $headerStyle = [
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['rgb' => '0F172A']],
        ];

        $periods = [
            'monthly' => 'Месяц (мир)',
            'regional_monthly' => 'Месяц (BY/RU)',
            'yearly' => 'Год',
            'weekly' => 'Неделя',
        ];

        $plansSheet = $spreadsheet->getActiveSheet();
        $plansSheet->setTitle('Тарифы');

        $headers = ['Тариф', ...array_values($periods), 'Источник'];
        foreach ($headers as $col => $title) {
            $cell = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col + 1).'1';
            $plansSheet->setCellValue($cell, $title);
        }
        $plansSheet->getStyle('A1:F1')->applyFromArray($headerStyle);

        $overrides = PlanCatalog::priceOverrides();
        $row = 2;
        foreach (['free', 'pro', 'premium', 'business'] as $plan) {
            $name = PlanCatalog::plans()[$plan]['name'] ?? $plan;
            $plansSheet->setCellValue("A$row", $name);

            $fromAdmin = false;
            $col = 2;
            foreach (array_keys($periods) as $period) {
                $key = $plan.'.'.$period;
                $value = $period === 'monthly'
                    ? PlanCatalog::monthlyPrice($plan)
                    : ($period === 'regional_monthly'
                        ? PlanCatalog::monthlyPrice($plan, true)
                        : PlanCatalog::periodPrice($plan, $period));

                $plansSheet->setCellValue(
                    \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col).$row,
                    $value === null ? '—' : $value
                );

                if (array_key_exists($key, $overrides) && $overrides[$key] !== null) {
                    $fromAdmin = true;
                }
                $col++;
            }

            $plansSheet->setCellValue("F$row", $fromAdmin ? 'админка' : 'конфиг');
            $row++;
        }
        foreach (range('A', 'F') as $c) $plansSheet->getColumnDimension($c)->setAutoSize(true);

        $itemsSheet = $spreadsheet->createSheet();
        $itemsSheet->setTitle('Витрина');
        $itemHeaders = ['Ключ', 'Модуль', 'Вид', 'Название', 'Цена', 'Валюта', 'Период', 'Free', 'Pro', 'Premium', 'Вкл'];
        foreach ($itemHeaders as $col => $title) {
            $cell = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col + 1).'1';
            $itemsSheet->setCellValue($cell, $title);
        }
        $itemsSheet->getStyle('A1:K1')->applyFromArray($headerStyle);

        $irow = 2;
        foreach (PaymentItem::orderBy('sort_order')->orderBy('id')->get() as $item) {
            $byPlan = $item->payload['prices_by_plan'] ?? [];
            $itemsSheet->setCellValue("A$irow", $item->key);
            $itemsSheet->setCellValue("B$irow", $item->module);
            $itemsSheet->setCellValue("C$irow", $item->kind);
            $itemsSheet->setCellValue("D$irow", $item->name);
            $itemsSheet->setCellValue("E$irow", $item->price === null ? '—' : (float) $item->price);
            $itemsSheet->setCellValue("F$irow", $item->currency ?? 'USD');
            $itemsSheet->setCellValue("G$irow", $item->period ?? '—');
            $itemsSheet->setCellValue("H$irow", $byPlan['free'] ?? '—');
            $itemsSheet->setCellValue("I$irow", $byPlan['pro'] ?? '—');
            $itemsSheet->setCellValue("J$irow", $byPlan['premium'] ?? '—');
            $itemsSheet->setCellValue("K$irow", $item->is_active ? 'да' : 'нет');
            $irow++;
        }
        foreach (range('A', 'K') as $c) $itemsSheet->getColumnDimension($c)->setAutoSize(true);

        $spreadsheet->setActiveSheetIndex(0);
        $fileName = 'payments-'.now()->format('Y-m-d_H-i').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet))->save('php://output');
        }, $fileName, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    /**
     * Валидация строки витрины (создание и правка).
     *
     * @param Request $request
     * @return array<string, mixed>
     */
    private function validateItem(Request $request): array
    {
        return $request->validate([
            'key' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_.-]+$/'],
            'module' => ['required', 'string', 'in:general,ulove,upin,uflow,districts,business'],
            'kind' => ['required', 'string', 'in:credit_pack,feature,ad'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'currency' => ['nullable', 'string', 'max:8'],
            'period' => ['nullable', 'string', 'in:once,week,month,year'],
            'payload' => ['nullable', 'array'],
            'payload.prices_by_plan' => ['nullable', 'array'],
            'payload.prices_by_plan.free' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'payload.prices_by_plan.pro' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'payload.prices_by_plan.premium' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'payload.prices_by_plan.business' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ]);
    }

    /**
     * Длинный период конфига в короткий период витрины.
     *
     * @param string $period monthly|regional_monthly|yearly|weekly
     * @return string
     */
    private function shortPeriod(string $period): string
    {
        return match ($period) {
            'yearly' => 'year',
            'weekly' => 'week',
            default => 'month',
        };
    }
}
