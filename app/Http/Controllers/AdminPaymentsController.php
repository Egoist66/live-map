<?php

namespace App\Http\Controllers;

use App\Exports\TariffsExport;
use App\Imports\TariffsImport;
use App\Models\PaymentItem;
use App\Services\PlanCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

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
                    'yearly' => PlanCatalog::periodPrice($plan, 'yearly'),
                    'weekly' => PlanCatalog::periodPrice($plan, 'weekly'),
                ],
            ];
        }

        return response()->json([
            'plans' => $plans,
            'features_by_plan' => $this->featuresByPlan(),
            'gateways' => [
                ['id' => 'stripe', 'label' => 'Карты, Apple Pay и Google Pay', 'status' => 'not_connected'],
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
            'prices.*.period' => ['required', 'string', 'in:monthly,yearly,weekly'],
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
     * Выгрузка всего ценообразования в Excel через maatwebsite/excel.
     *
     * Четыре листа: «Как пользоваться» (инструкция + легенда + ссылки),
     * «Тарифы» (цены и описания с цветом по тарифу и живыми итогами),
     * «Что входит» (фишки: да — зелёным, нет — красным, списки из коробки),
     * «Витрина» (товары с ценами под тарифы). Файл — он же шаблон для
     * обратной загрузки: серые «Ключи» позволяют импорту обновить строки,
     * а не задвоить их.
     *
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function export(): BinaryFileResponse
    {
        $fileName = 'tarify-'.now()->format('Y-m-d_H-i').'.xlsx';

        return Excel::download(new TariffsExport(), $fileName);
    }

    /**
     * Загрузка тарифов из Excel обратно в базу.
     *
     * Листы ищутся по заголовкам (порядок и названия вкладок не важны),
     * человеческие слова понимаются наравне с кодами: «Знакомства» = ulove,
     * «Пакет кредитов» = credit_pack, «Один раз» = once, «да» = видно.
     * Без галочки «очистить» — строки обновляются по ключам, новое
     * добавляется. С галочкой — всё удаляется и загружается только из
     * файла: так восстанавливаются тарифы, цены, фишки, описания и товары
     * даже после полной очистки.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function import(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
            'replace' => ['nullable', 'boolean'],
        ]);

        $path = $data['file']->getRealPath();

        if ($path === false) {
            return response()->json(['message' => 'Не удалось прочитать файл.'], 422);
        }

        $result = (new TariffsImport())->importFile($path, (bool) ($data['replace'] ?? false));

        $message = $this->importSummary($result);

        return response()->json([
            'imported' => $result,
            'message' => $message,
        ]);
    }

    /**
     * Человеческий итог импорта для тоста в админке.
     *
     * @param array{plans_updated:int,features_saved:int,items_saved:int,deleted:int,errors:list<string>,warnings:list<string>} $result итог загрузки
     */
    private function importSummary(array $result): string
    {
        $parts = [];

        if ($result['deleted'] > 0) {
            $parts[] = "очищено {$result['deleted']}";
        }

        $parts[] = "тарифы: {$result['plans_updated']}";
        $parts[] = "фишки: {$result['features_saved']}";
        $parts[] = "товары: {$result['items_saved']}";

        $summary = 'Готово — '.implode(', ', $parts).'.';

        if ($result['errors'] !== []) {
            $summary .= ' Ошибок: '.count($result['errors']).' (первые — в ответе).';
        }

        return $summary;
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
     * @param string $period monthly|yearly|weekly
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
