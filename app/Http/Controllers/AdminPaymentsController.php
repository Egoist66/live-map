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
     * Сводка: цены тарифов, их возможности, статусы оплаты, счётчики витрины.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function overview(): JsonResponse
    {
        $plans = [];
        $catalog = PlanCatalog::plans();

        foreach (['free', 'pro', 'premium', 'business'] as $plan) {
            $plans[] = [
                'id' => $plan,
                'name' => $catalog[$plan]['name'] ?? $plan,
                'tagline' => $catalog[$plan]['tagline'] ?? '',
                'audience' => $catalog[$plan]['audience'] ?? 'users',
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
            'features_by_plan' => $this->featuresByPlan(),
            'gateways' => [
                ['id' => 'stripe', 'label' => 'Карты мира, Apple Pay и Google Pay', 'status' => 'not_connected'],
                ['id' => 'local', 'label' => 'МИР, СБП и ЕРИП (Россия и Беларусь)', 'status' => 'not_connected'],
            ],
            'gateway_note' => 'Пока оплата принимается вручную: человек пишет в поддержку после перевода, администратор включает тариф кнопкой. Автоматическая оплата картой появится позже — блоки выше просто показывают, что она ещё не подключена.',
            'items_total' => PaymentItem::whereNotIn('kind', ['plan_price', 'plan_meta'])->count(),
            'items_active' => PaymentItem::where('is_active', true)->whereNotIn('kind', ['plan_price', 'plan_meta'])->count(),
        ]);
    }

    /**
     * Вся витрина для таблицы (включая выключенные, без служебных строк тарифов).
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function items(): JsonResponse
    {
        $rows = PaymentItem::whereNotIn('kind', ['plan_price', 'plan_meta'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['items' => $rows]);
    }

    /**
     * Возможности тарифов, сгруппированные по тарифу.
     *
     * Возможность — это позиция витрины с видом «фишка», у которой
     * в дополнительных данных указан тариф (plan или plans).
     * Без привязки к тарифу фишка считается общей и показывается везде.
     *
     * @return array<string, list<\App\Models\PaymentItem>>
     */
    private function featuresByPlan(): array
    {
        $grouped = [
            'free' => [],
            'pro' => [],
            'premium' => [],
            'business' => [],
        ];

        $features = PaymentItem::where('kind', 'feature')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        foreach ($features as $feature) {
            $payload = $feature->payload ?? [];

            $linked = [];

            if (isset($payload['plan']) && is_string($payload['plan'])) {
                $linked[] = $payload['plan'];
            }

            if (isset($payload['plans']) && is_array($payload['plans'])) {
                foreach ($payload['plans'] as $planId) {
                    if (is_string($planId)) {
                        $linked[] = $planId;
                    }
                }
            }

            $linked = array_unique($linked);

            if ($linked === []) {
                continue;
            }

            foreach ($linked as $planId) {
                if (array_key_exists($planId, $grouped)) {
                    $grouped[$planId][] = $feature;
                }
            }
        }

        return $grouped;
    }

    /**
     * Массово сохранить названия и описания тарифов.
     *
     * По умолчанию берутся из настроек приложения, а всё, что
     * поменяли здесь, хранится отдельно и показывается везде:
     * в приложении, в боте и на витрине. Пустое описание = как было.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function savePlanMeta(Request $request): JsonResponse
    {
        $data = $request->validate([
            'meta' => ['required', 'array', 'min:1'],
            'meta.*.plan' => ['required', 'string', 'in:free,pro,premium,business'],
            'meta.*.name' => ['required', 'string', 'max:60'],
            'meta.*.tagline' => ['nullable', 'string', 'max:200'],
        ]);

        foreach ($data['meta'] as $row) {
            PaymentItem::updateOrCreate(
                ['key' => $row['plan'].'.meta'],
                [
                    'module' => $row['plan'] === 'business' ? 'business' : 'general',
                    'kind' => 'plan_meta',
                    'name' => 'Описание тарифа '.($row['plan']),
                    'price' => null,
                    'currency' => 'USD',
                    'period' => 'once',
                    'payload' => [
                        'name' => $row['name'],
                        'tagline' => $row['tagline'],
                    ],
                    'is_active' => true,
                ]
            );
        }

        PlanCatalog::bustPriceCache();

        return response()->json(['saved' => count($data['meta'])]);
    }

    /**
     * Массово сохранить цены тарифов.
     *
     * По умолчанию цены берутся из настроек приложения. Пустое поле
     * в админке = вернуть цену по умолчанию. После сохранения
     * приложение и бот показывают новые цены сразу.
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
        PlanCatalog::bustPriceCache();

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
        if ($item->kind === 'plan_price' || $item->kind === 'plan_meta') {
            return response()->json(['message' => 'Тариф меняется в карточке выше, а не здесь.'], 422);
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
        if ($item->kind === 'plan_price' || $item->kind === 'plan_meta') {
            return response()->json(['message' => 'Тариф нельзя удалить из витрины — он правится в карточке выше.'], 422);
        }

        $item->delete();
        PlanCatalog::bustPriceCache();

        return response()->json(['deleted' => true]);
    }

    /**
     * Выгрузка всего ценообразования в Excel для тех, кто занимается ценами.
     *
     * Лист «Тарифы»: название, кому подходит, описание и все четыре цены
     * (итоговые — как видят люди) + помечено, меняли ли цену вручную.
     * Лист «Что входит»: какая возможность в какой тариф входит и видна ли.
     * Лист «Витрина»: разовые товары с ценами и ценами под каждый тариф.
     * Везде только человеческие слова, шапка закреплена, фильтры включены.
     *
     * @return \Symfony\Component\HttpFoundation\StreamedResponse
     */
    public function export()
    {
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $spreadsheet->getProperties()
            ->setCreator('ULove')
            ->setTitle('Тарифы и витрина');

        $this->fillPlansSheet($spreadsheet);
        $this->fillFeaturesSheet($spreadsheet);
        $this->fillShowcaseSheet($spreadsheet);

        $spreadsheet->setActiveSheetIndex(0);
        $fileName = 'tarify-'.now()->format('Y-m-d_H-i').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet))->save('php://output');
        }, $fileName, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    /**
     * Лист «Тарифы»: все тарифы с итоговыми ценами и пометкой ручных правок.
     *
     * @param \PhpOffice\PhpSpreadsheet\Spreadsheet $book книга Excel
     */
    private function fillPlansSheet(\PhpOffice\PhpSpreadsheet\Spreadsheet $book): void
    {
        $sheet = $book->getActiveSheet();
        $sheet->setTitle('Тарифы');

        $headers = [
            'Тариф',
            'Для кого',
            'Описание',
            'Месяц, весь мир',
            'Месяц, Россия и Беларусь',
            'Год',
            'Неделя',
            'Цены',
        ];
        $this->writeHeader($sheet, $headers);

        $catalog = PlanCatalog::plans();
        $priceOverrides = PlanCatalog::priceOverrides();
        $metaOverrides = PlanCatalog::metaOverrides();

        $row = 2;
        foreach (['free', 'pro', 'premium', 'business'] as $plan) {
            $info = $catalog[$plan] ?? [];

            $sheet->setCellValue("A$row", (string) ($info['name'] ?? $plan));
            $sheet->setCellValue("B$row", $this->audienceLabel((string) ($info['audience'] ?? 'users')));
            $sheet->setCellValue("C$row", (string) ($info['tagline'] ?? ''));

            $this->writePlanPrice($sheet, "D$row", PlanCatalog::monthlyPrice($plan), true);
            $this->writePlanPrice($sheet, "E$row", PlanCatalog::monthlyPrice($plan, true), true);
            $this->writePlanPrice($sheet, "F$row", PlanCatalog::periodPrice($plan, 'yearly'), false);
            $this->writePlanPrice($sheet, "G$row", PlanCatalog::periodPrice($plan, 'weekly'), false);

            $sheet->setCellValue("H$row", $this->planSource($plan, $priceOverrides, $metaOverrides));

            $row++;
        }

        $this->finishSheet($sheet, 'A', 'H', $row, ['D', 'E', 'F', 'G']);
    }

    /**
     * Лист «Что входит»: какая возможность в каком тарифе и видна ли она.
     *
     * @param \PhpOffice\PhpSpreadsheet\Spreadsheet $book книга Excel
     */
    private function fillFeaturesSheet(\PhpOffice\PhpSpreadsheet\Spreadsheet $book): void
    {
        $sheet = $book->createSheet();
        $sheet->setTitle('Что входит');

        $this->writeHeader($sheet, ['Тариф', 'Возможность', 'Пояснение', 'Показывается']);

        $catalog = PlanCatalog::plans();

        $features = PaymentItem::where('kind', 'feature')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $byPlan = ['free' => [], 'pro' => [], 'premium' => [], 'business' => []];
        foreach ($features as $feature) {
            $payload = is_array($feature->payload) ? $feature->payload : [];
            $linked = [];

            if (isset($payload['plan']) && is_string($payload['plan'])) {
                $linked[] = $payload['plan'];
            }

            if (isset($payload['plans']) && is_array($payload['plans'])) {
                foreach ($payload['plans'] as $planId) {
                    if (is_string($planId)) {
                        $linked[] = $planId;
                    }
                }
            }

            foreach (array_unique($linked) as $planId) {
                if (array_key_exists($planId, $byPlan)) {
                    $byPlan[$planId][] = $feature;
                }
            }
        }

        $row = 2;
        foreach (['free', 'pro', 'premium', 'business'] as $plan) {
            $planName = (string) ($catalog[$plan]['name'] ?? $plan);

            if ($byPlan[$plan] === []) {
                $sheet->setCellValue("A$row", $planName);
                $sheet->setCellValue("B$row", 'Пока пусто');
                $sheet->setCellValue("C$row", 'Добавьте через карточку тарифа');
                $sheet->setCellValue("D$row", '—');
                $row++;
                continue;
            }

            foreach ($byPlan[$plan] as $feature) {
                $sheet->setCellValue("A$row", $planName);
                $sheet->setCellValue("B$row", (string) $feature->name);
                $sheet->setCellValue("C$row", (string) ($feature->description ?? ''));
                $sheet->setCellValue("D$row", $feature->is_active ? 'да' : 'нет');
                $row++;
            }
        }

        $this->finishSheet($sheet, 'A', 'D', $row, []);
    }

    /**
     * Лист «Витрина»: разовые товары с ценами под каждый тариф.
     *
     * @param \PhpOffice\PhpSpreadsheet\Spreadsheet $book книга Excel
     */
    private function fillShowcaseSheet(\PhpOffice\PhpSpreadsheet\Spreadsheet $book): void
    {
        $sheet = $book->createSheet();
        $sheet->setTitle('Витрина');

        $catalog = PlanCatalog::plans();
        $planName = static fn (string $id): string => (string) ($catalog[$id]['name'] ?? $id);

        $this->writeHeader($sheet, [
            'Товар',
            'Пояснение',
            'Где показывается',
            'Что это',
            'Цена',
            'Как часто платят',
            'Для '.$planName('free'),
            'Для '.$planName('pro'),
            'Для '.$planName('premium'),
            'Для '.$planName('business'),
            'В продаже',
        ]);

        $items = PaymentItem::whereNotIn('kind', ['plan_price', 'plan_meta', 'feature'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $row = 2;
        foreach ($items as $item) {
            $payload = is_array($item->payload) ? $item->payload : [];
            $ownPrices = is_array($payload['prices_by_plan'] ?? null) ? $payload['prices_by_plan'] : [];

            $sheet->setCellValue("A$row", (string) $item->name);
            $sheet->setCellValue("B$row", (string) ($item->description ?? ''));
            $sheet->setCellValue("C$row", $this->moduleLabel((string) $item->module));
            $sheet->setCellValue("D$row", $this->kindLabel((string) $item->kind));

            $this->writeMoney($sheet, "E$row", $item->price === null ? null : (float) $item->price, 'Бесплатно');
            $sheet->setCellValue("F$row", $this->periodLabel($item->period));

            $col = 'G';
            foreach (['free', 'pro', 'premium', 'business'] as $planId) {
                $own = $ownPrices[$planId] ?? null;
                $this->writeMoney($sheet, $col.$row, $own === null ? null : (float) $own, 'Как всем');
                $col++;
            }

            $sheet->setCellValue("K$row", $item->is_active ? 'да' : 'нет');
            $row++;
        }

        $this->finishSheet($sheet, 'A', 'K', $row, ['E', 'G', 'H', 'I', 'J']);
    }

    /**
     * Шапка листа: тёмная строка-заголовок.
     *
     * @param \PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet лист
     * @param list<string> $headers подписи колонок
     */
    private function writeHeader(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet, array $headers): void
    {
        foreach ($headers as $index => $title) {
            $cell = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($index + 1).'1';
            $sheet->setCellValue($cell, $title);
        }

        $last = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($headers));
        $sheet->getStyle("A1:{$last}1")->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['rgb' => '0F172A']],
        ]);
    }

    /**
     * Оформить лист: ширина колонок, закреплённая шапка, фильтры, формат денег.
     *
     * @param \PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet лист
     * @param string $first первая колонка (напр. 'A')
     * @param string $last последняя колонка (напр. 'H')
     * @param int $nextRow номер первой пустой строки
     * @param list<string> $moneyColumns колонки с деньгами
     */
    private function finishSheet(
        \PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet,
        string $first,
        string $last,
        int $nextRow,
        array $moneyColumns
    ): void {
        foreach (range($first, $last) as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }

        $sheet->freezePane('A2');
        $sheet->setAutoFilter("{$first}1:{$last}".($nextRow - 1));

        if ($nextRow <= 2) {
            return;
        }

        foreach ($moneyColumns as $column) {
            $sheet->getStyle("{$column}2:{$column}".($nextRow - 1))
                ->getNumberFormat()
                ->setFormatCode('"$"#,##0.00');
        }
    }

    /**
     * Цена тарифа в ячейку: пустой месяц = бесплатно, пустой год/неделя = нет.
     *
     * @param \PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet лист
     * @param string $cell адрес ячейки
     * @param float|null $value цена
     * @param bool $isMonthly месячная ли цена (там пусто = бесплатно)
     */
    private function writePlanPrice(
        \PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet,
        string $cell,
        ?float $value,
        bool $isMonthly
    ): void {
        if ($value === null) {
            $sheet->setCellValue($cell, $isMonthly ? 'Бесплатно' : 'Нет');
            return;
        }

        $sheet->setCellValue($cell, $value);
    }

    /**
     * Деньги в ячейку: число либо понятное слово вместо пустоты.
     *
     * @param \PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet лист
     * @param string $cell адрес ячейки
     * @param float|null $value цена
     * @param string $empty что написать вместо пустоты
     */
    private function writeMoney(
        \PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet,
        string $cell,
        ?float $value,
        string $empty
    ): void {
        if ($value === null) {
            $sheet->setCellValue($cell, $empty);
            return;
        }

        $sheet->setCellValue($cell, $value);
    }

    /**
     * Откуда цена тарифа: меняли ли её вручную в админке.
     *
     * @param string $plan тариф
     * @param array<string, float|null> $priceOverrides правки цен
     * @param array<string, array{name?:string,tagline?:string}> $metaOverrides правки описаний
     */
    private function planSource(string $plan, array $priceOverrides, array $metaOverrides): string
    {
        foreach (['monthly', 'regional_monthly', 'yearly', 'weekly'] as $period) {
            $key = $plan.'.'.$period;

            if (array_key_exists($key, $priceOverrides) && $priceOverrides[$key] !== null) {
                return 'Изменены вручную';
            }
        }

        if (array_key_exists($plan, $metaOverrides)) {
            return 'Изменены вручную';
        }

        return 'Стандартные';
    }

    /**
     * Кому подходит тариф, человеческим языком.
     */
    private function audienceLabel(string $audience): string
    {
        return $audience === 'organizations' ? 'Для компаний' : 'Для всех';
    }

    /**
     * Где показывается товар, человеческим языком.
     */
    private function moduleLabel(string $module): string
    {
        return match ($module) {
            'ulove' => 'Знакомства',
            'upin' => 'Карта',
            'uflow' => 'Лента',
            'districts' => 'Районы',
            'business' => 'Компании',
            default => 'Везде',
        };
    }

    /**
     * Что за товар, человеческим языком.
     */
    private function kindLabel(string $kind): string
    {
        return match ($kind) {
            'credit_pack' => 'Пакет кредитов',
            'ad' => 'Реклама',
            default => 'Товар',
        };
    }

    /**
     * Как часто платят, человеческим языком.
     *
     * @param string|null $period once|week|month|year
     */
    private function periodLabel(?string $period): string
    {
        return match ($period) {
            'week' => 'Каждую неделю',
            'month' => 'Каждый месяц',
            'year' => 'Сразу за год',
            default => 'Один раз',
        };
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
            'payload.plan' => ['nullable', 'string', 'in:free,pro,premium,business'],
            'payload.plans' => ['nullable', 'array'],
            'payload.plans.*' => ['string', 'in:free,pro,premium,business'],
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
