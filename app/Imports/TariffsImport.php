<?php

namespace App\Imports;

use App\Models\PaymentItem;
use App\Services\PlanCatalog;
use App\Services\TariffsExcelLabels;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\ToArray;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Загрузка тарифов из Excel обратно в базу.
 *
 * Читает файл через maatwebsite/excel (Excel::toArray), находит листы
 * по заголовкам (порядок и названия вкладок не важны), разбирает
 * человеческие слова в коды и в одной транзакции обновляет всё:
 * названия/описания тарифов, цены, фишки и витрину.
 *
 * Главный сценарий: всё удалили → загрузили этот же файл с
 * «Очистить текущие данные» → тарифы, цены, фишки, описания и товары
 * встали обратно один в один.
 */
class TariffsImport implements ToArray
{
    /**
     * Требуется интерфейсом ToArray: при чтении через Excel::toArray
     * сами данные возвращаются результатом метода, сюда ничего не пишем.
     *
     * @param array<array-key, mixed> $array строки одного листа
     */
    public function array(array $array): void
    {
    }

    /**
     * Прочитать файл и применить его к базе.
     *
     * @param string $path путь к загруженному файлу
     * @param bool $replace true = сначала удалить все строки payment_items
     * @return array{plans_updated:int,features_saved:int,items_saved:int,deleted:int,errors:list<string>,warnings:list<string>}
     */
    public function importFile(string $path, bool $replace = false): array
    {
        $sheets = Excel::toArray($this, $path);

        return $this->importFromArrays(is_array($sheets) ? $sheets : [], $replace);
    }

    /**
     * Разобрать уже прочитанные листы и сохранить в базу.
     *
     * Листы ищутся по заголовкам, а не по названиям вкладок: файл можно
     * переименовывать и двигать вкладки — разбор всё равно найдёт своё.
     *
     * @param list<list<list<mixed>>> $sheets листы → строки → клетки
     * @param bool $replace true = сначала удалить все строки payment_items
     * @return array{plans_updated:int,features_saved:int,items_saved:int,deleted:int,errors:list<string>,warnings:list<string>}
     */
    public function importFromArrays(array $sheets, bool $replace = false): array
    {
        $errors = [];
        $warnings = [];
        $planNames = $this->currentPlanNames();

        $plansSheet = $this->findSheet($sheets, ['ID тарифа', 'Статус цен']);
        $featuresSheet = $this->findSheet($sheets, ['Возможность', 'Показывается']);
        $showcaseSheet = $this->findSheet($sheets, ['В продаже', 'Как часто платят']);

        if ($plansSheet === null) {
            $warnings[] = 'Лист «Тарифы» не найден (ищу по заголовкам «ID тарифа», «Статус цен») — цены и описания не тронуты.';
        }

        if ($featuresSheet === null) {
            $warnings[] = 'Лист «Что входит» не найден (ищу по заголовкам «Возможность», «Показывается») — фишки не тронуты.';
        }

        if ($showcaseSheet === null) {
            $warnings[] = 'Лист «Витрина» не найден (ищу по заголовкам «В продаже», «Как часто платят») — товары не тронуты.';
        }

        $planMeta = [];
        $planPrices = [];
        $features = [];
        $items = [];

        if ($plansSheet !== null) {
            [$planMeta, $planPrices] = $this->parsePlans($plansSheet, $planNames, $errors, $warnings);
        }

        if ($featuresSheet !== null) {
            $features = $this->parseFeatures($featuresSheet, $planNames, $errors, $warnings);
        }

        if ($showcaseSheet !== null) {
            $items = $this->parseShowcase($showcaseSheet, $errors, $warnings);
        }

        $deleted = 0;
        $plansUpdated = 0;
        $featuresSaved = 0;
        $itemsSaved = 0;

        DB::transaction(function () use (
            $replace,
            $planMeta,
            $planPrices,
            $features,
            $items,
            &$deleted,
            &$plansUpdated,
            &$featuresSaved,
            &$itemsSaved
        ): void {
            if ($replace) {
                $deleted = (int) PaymentItem::query()->count();
                PaymentItem::query()->delete();
            }

            foreach ($planMeta as $plan => $meta) {
                PaymentItem::updateOrCreate(
                    ['key' => $plan.'.meta'],
                    [
                        'module' => $plan === 'business' ? 'business' : 'general',
                        'kind' => 'plan_meta',
                        'name' => 'Описание тарифа '.$plan,
                        'price' => null,
                        'currency' => 'USD',
                        'period' => 'once',
                        'payload' => $meta,
                        'is_active' => true,
                    ]
                );

                $plansUpdated++;
            }

            foreach ($planPrices as $key => $row) {
                PaymentItem::updateOrCreate(
                    ['key' => $key],
                    [
                        'module' => $row['module'],
                        'kind' => 'plan_price',
                        'name' => 'Цена '.$row['plan'].' / '.$row['period'],
                        'price' => $row['price'],
                        'currency' => 'USD',
                        'period' => $row['short'],
                        'is_active' => true,
                    ]
                );

                $plansUpdated++;
            }

            foreach ($features as $row) {
                $existing = PaymentItem::where('key', $row['key'])->first();
                $payload = $existing && is_array($existing->payload) ? $existing->payload : [];

                if ($row['plan'] === null) {
                    unset($payload['plan'], $payload['plans']);
                } else {
                    $payload['plan'] = $row['plan'];
                    unset($payload['plans']);
                }

                PaymentItem::updateOrCreate(
                    ['key' => $row['key']],
                    [
                        'module' => 'general',
                        'kind' => 'feature',
                        'name' => $row['name'],
                        'description' => $row['description'],
                        'price' => null,
                        'currency' => 'USD',
                        'period' => 'once',
                        'payload' => $payload,
                        'is_active' => $row['is_active'],
                        'sort_order' => $row['sort_order'],
                    ]
                );

                $featuresSaved++;
            }

            foreach ($items as $row) {
                $existing = PaymentItem::where('key', $row['key'])->first();
                $base = $existing && is_array($existing->payload) ? $existing->payload : [];
                $payload = array_merge($base, $row['extras']);
                $payload['prices_by_plan'] = $row['prices_by_plan'];

                PaymentItem::updateOrCreate(
                    ['key' => $row['key']],
                    [
                        'module' => $row['module'],
                        'kind' => $row['kind'],
                        'name' => $row['name'],
                        'description' => $row['description'],
                        'price' => $row['price'],
                        'currency' => 'USD',
                        'period' => $row['period'],
                        'payload' => $payload,
                        'is_active' => $row['is_active'],
                        'sort_order' => $row['sort_order'],
                    ]
                );

                $itemsSaved++;
            }
        });

        PlanCatalog::bustPriceCache();

        return [
            'plans_updated' => $plansUpdated,
            'features_saved' => $featuresSaved,
            'items_saved' => $itemsSaved,
            'deleted' => $deleted,
            'errors' => array_values($errors),
            'warnings' => array_values($warnings),
        ];
    }

    /**
     * Живые названия тарифов для обратного маппинга (название → id).
     *
     * @return array<string, string>
     */
    private function currentPlanNames(): array
    {
        $catalog = PlanCatalog::plans();
        $names = [];

        foreach (TariffsExcelLabels::PLAN_ORDER as $plan) {
            $names[$plan] = (string) ($catalog[$plan]['name'] ?? $plan);
        }

        $names['free'] = $names['free'] ?? 'Free';
        $names['pro'] = $names['pro'] ?? 'PRO';
        $names['premium'] = $names['premium'] ?? 'Premium';
        $names['business'] = $names['business'] ?? 'Business';

        return $names;
    }

    /**
     * Найти лист по словам в первой строке ( регистр и пробелы не важны).
     *
     * @param list<list<list<mixed>>> $sheets все листы
     * @param list<string> $needles слова-маркеры заголовков
     * @return list<list<mixed>>|null строки листа
     */
    private function findSheet(array $sheets, array $needles): ?array
    {
        foreach ($sheets as $sheet) {
            if (! is_array($sheet) || $sheet === []) {
                continue;
            }

            $header = $sheet[0] ?? [];
            $flat = TariffsExcelLabels::norm(implode(' | ', array_map(
                static fn ($cell): string => (string) ($cell ?? ''),
                is_array($header) ? $header : []
            )));

            $found = 0;

            foreach ($needles as $needle) {
                if (str_contains($flat, TariffsExcelLabels::norm($needle))) {
                    $found++;
                }
            }

            if ($found === count($needles)) {
                return $sheet;
            }
        }

        return null;
    }

    /**
     * Индексы колонок по заголовку первой строки.
     *
     * @param list<mixed> $header первая строка листа
     * @param list<string> $wanted нужные заголовки
     * @return array<string, int|null>
     */
    private function headerIndex(array $header, array $wanted): array
    {
        $normed = [];

        foreach ($header as $index => $cell) {
            $normed[TariffsExcelLabels::norm($cell)] = (int) $index;
        }

        $out = [];

        foreach ($wanted as $name) {
            $out[$name] = $normed[TariffsExcelLabels::norm($name)] ?? null;
        }

        return $out;
    }

    /**
     * Клетка строки по индексу колонки.
     *
     * @param list<mixed> $row строка листа
     * @param int|null $index индекс колонки
     */
    private function cell(array $row, ?int $index): mixed
    {
        if ($index === null) {
            return null;
        }

        return $row[$index] ?? null;
    }

    /**
     * Строка полностью пустая?
     *
     * @param list<mixed> $row строка листа
     */
    private function isEmptyRow(array $row): bool
    {
        foreach ($row as $cell) {
            if (trim((string) ($cell ?? '')) !== '') {
                return false;
            }
        }

        return true;
    }

    /**
     * Разобрать лист «Тарифы».
     *
     * Цена одна для всех стран: месяц, год, неделя. Старые файлы с колонкой
     * «Месяц, Россия и Беларусь» тоже читаются: месячная цена берётся из
     * «Месяц» (или legacy «Месяц, весь мир»), региональная колонка молча
     * пропускается — в текущей модели её нет.
     *
     * @param list<list<mixed>> $sheet строки листа с шапкой
     * @param array<string, string> $planNames id → название
     * @param list<string> $errors ошибки по строкам
     * @param list<string> $warnings предупреждения
     * @return array{0: array<string, array{name:string,tagline:string}>, 1: array<string, array{plan:string,period:string,short:string,module:string,price:float|null}>}
     */
    private function parsePlans(array $sheet, array $planNames, array &$errors, array &$warnings): array
    {
        $header = $sheet[0] ?? [];
        $col = $this->headerIndex(
            is_array($header) ? $header : [],
            array_merge(TariffsExcelLabels::PLANS_HEADERS, ['Месяц, весь мир', 'Месяц, Россия и Беларусь'])
        );

        $meta = [];
        $prices = [];
        $seen = [];

        foreach (array_slice($sheet, 1) as $offset => $rawRow) {
            $row = is_array($rawRow) ? array_values($rawRow) : [];
            $line = $offset + 2;

            if ($this->isEmptyRow($row)) {
                continue;
            }

            $plan = TariffsExcelLabels::parsePlan($this->cell($row, $col['ID тарифа']), $planNames);

            if ($plan === null) {
                $plan = TariffsExcelLabels::parsePlan($this->cell($row, $col['Тариф']), $planNames);
            }

            if ($plan === null) {
                if ($this->plansRowEmpty($row, $col)) {
                    continue;
                }

                $errors[] = "Тарифы, строка {$line}: непонятный тариф — нужно free/pro/premium/business или название.";
                continue;
            }

            if (isset($seen[$plan])) {
                $warnings[] = "Тарифы, строка {$line}: тариф уже был выше — беру последний.";
            }

            $seen[$plan] = true;

            $name = trim((string) ($this->cell($row, $col['Тариф']) ?? ''));
            $tagline = trim((string) ($this->cell($row, $col['Описание']) ?? ''));

            if ($name === '') {
                $name = $planNames[$plan] ?? $plan;
                $warnings[] = "Тарифы, строка {$line}: пустое название — оставил «{$name}».";
            }

            if (mb_strlen($name) > 60) {
                $name = mb_substr($name, 0, 60);
                $warnings[] = "Тарифы, строка {$line}: название обрезано до 60 символов.";
            }

            if (mb_strlen($tagline) > 200) {
                $tagline = mb_substr($tagline, 0, 200);
                $warnings[] = "Тарифы, строка {$line}: описание обрезано до 200 символов.";
            }

            $meta[$plan] = [
                'name' => $name,
                'tagline' => $tagline,
            ];

            $monthlyCell = $this->cell($row, $col['Месяц']);

            if ($monthlyCell === null || trim((string) $monthlyCell) === '') {
                $monthlyCell = $this->cell($row, $col['Месяц, весь мир'] ?? null);
            }

            $periods = [
                'monthly' => $monthlyCell,
                'yearly' => $this->cell($row, $col['Год']),
                'weekly' => $this->cell($row, $col['Неделя']),
            ];

            foreach ($periods as $period => $rawPrice) {
                $prices[$plan.'.'.$period] = [
                    'plan' => $plan,
                    'period' => $period,
                    'short' => $this->shortPeriod($period),
                    'module' => $plan === 'business' ? 'business' : 'general',
                    'price' => TariffsExcelLabels::parsePrice($rawPrice),
                ];
            }
        }

        return [$meta, $prices];
    }

    /**
     * В строке тарифов нет ни тарифа, ни цен — служебная строка (итоги и т.п.).
     *
     * @param list<mixed> $row строка листа
     * @param array<string, int|null> $col индексы колонок
     */
    private function plansRowEmpty(array $row, array $col): bool
    {
        foreach (['Месяц', 'Месяц, весь мир', 'Месяц, Россия и Беларусь', 'Год', 'Неделя'] as $priceCol) {
            $value = $this->cell($row, $col[$priceCol] ?? null);

            if (trim((string) ($value ?? '')) !== '') {
                return false;
            }
        }

        return true;
    }

    /**
     * Разобрать лист «Что входит».
     *
     * Пустой тариф или прочерк — потеряшка без тарифа: сохранится как есть,
     * ни в какой карточке не покажется, но и не потеряется при переезде.
     *
     * @param list<list<mixed>> $sheet строки листа с шапкой
     * @param array<string, string> $planNames id → название
     * @param list<string> $errors ошибки по строкам
     * @param list<string> $warnings предупреждения
     * @return list<array{key:string,plan:string|null,name:string,description:string|null,is_active:bool,sort_order:int}>
     */
    private function parseFeatures(array $sheet, array $planNames, array &$errors, array &$warnings): array
    {
        $header = $sheet[0] ?? [];
        $col = $this->headerIndex(is_array($header) ? $header : [], TariffsExcelLabels::FEATURES_HEADERS);

        $out = [];
        $usedKeys = [];
        $autoOrder = 10;

        foreach (array_slice($sheet, 1) as $offset => $rawRow) {
            $row = is_array($rawRow) ? array_values($rawRow) : [];
            $line = $offset + 2;

            if ($this->isEmptyRow($row)) {
                continue;
            }

            $name = trim((string) ($this->cell($row, $col['Возможность']) ?? ''));

            if ($name === '') {
                $errors[] = "Что входит, строка {$line}: пустая возможность — пропустил.";
                continue;
            }

            if (mb_strlen($name) > 120) {
                $name = mb_substr($name, 0, 120);
                $warnings[] = "Что входит, строка {$line}: название обрезано до 120 символов.";
            }

            $tariffCell = $this->cell($row, $col['Тариф']);
            $plan = TariffsExcelLabels::parsePlan($tariffCell, $planNames);

            if ($plan === null && ! $this->isHomelessMark($tariffCell)) {
                $errors[] = "Что входит, строка {$line} («{$name}»): непонятный тариф — пропустил.";
                continue;
            }

            $key = $this->cleanKey($this->cell($row, $col['Ключ']), $name, 'feat');

            if (isset($usedKeys[$key])) {
                $warnings[] = "Что входит, строка {$line}: ключ «{$key}» уже был — беру последний.";
            }

            $usedKeys[$key] = true;

            $description = trim((string) ($this->cell($row, $col['Пояснение']) ?? ''));

            if (mb_strlen($description) > 500) {
                $description = mb_substr($description, 0, 500);
                $warnings[] = "Что входит, строка {$line}: пояснение обрезано до 500 символов.";
            }

            $order = TariffsExcelLabels::parseSortOrder($this->cell($row, $col['Порядок'])) ?? $autoOrder;
            $autoOrder += 10;

            $out[] = [
                'key' => $key,
                'plan' => $plan,
                'name' => $name,
                'description' => $description === '' ? null : $description,
                'is_active' => TariffsExcelLabels::parseActive($this->cell($row, $col['Показывается']), true),
                'sort_order' => $order,
            ];
        }

        return $out;
    }

    /**
     * Разобрать лист «Витрина».
     *
     * Вид «Возможность тарифа» здесь — это разовая фишка без тарифа
     * (есть цена, нет привязки): сохраняется как есть, чтобы круговое
     * восстановление ничего не теряло. Служебная колонка «Данные (JSON)»
     * возвращает остатки payload (кредиты в пакете и т.п.).
     *
     * @param list<list<mixed>> $sheet строки листа с шапкой
     * @param list<string> $errors ошибки по строкам
     * @param list<string> $warnings предупреждения
     * @return list<array{key:string,name:string,description:string|null,module:string,kind:string,price:float|null,period:string,prices_by_plan:array<string,float|null>,extras:array<string,mixed>,is_active:bool,sort_order:int}>
     */
    private function parseShowcase(array $sheet, array &$errors, array &$warnings): array
    {
        $header = $sheet[0] ?? [];
        $col = $this->headerIndex(is_array($header) ? $header : [], TariffsExcelLabels::SHOWCASE_HEADERS);

        $out = [];
        $usedKeys = [];
        $autoOrder = 10;

        foreach (array_slice($sheet, 1) as $offset => $rawRow) {
            $row = is_array($rawRow) ? array_values($rawRow) : [];
            $line = $offset + 2;

            if ($this->isEmptyRow($row)) {
                continue;
            }

            $name = trim((string) ($this->cell($row, $col['Товар']) ?? ''));

            if ($name === '') {
                $errors[] = "Витрина, строка {$line}: пустой товар — пропустил.";
                continue;
            }

            if (mb_strlen($name) > 120) {
                $name = mb_substr($name, 0, 120);
                $warnings[] = "Витрина, строка {$line}: название обрезано до 120 символов.";
            }

            $key = $this->cleanKey($this->cell($row, $col['Ключ']), $name, 'item');

            if (isset($usedKeys[$key])) {
                $warnings[] = "Витрина, строка {$line}: ключ «{$key}» уже был — беру последний.";
            }

            $usedKeys[$key] = true;

            $kind = TariffsExcelLabels::parseKind($this->cell($row, $col['Что это']));

            $description = trim((string) ($this->cell($row, $col['Пояснение']) ?? ''));

            if (mb_strlen($description) > 500) {
                $description = mb_substr($description, 0, 500);
                $warnings[] = "Витрина, строка {$line}: пояснение обрезано до 500 символов.";
            }

            $order = TariffsExcelLabels::parseSortOrder($this->cell($row, $col['Порядок'])) ?? $autoOrder;
            $autoOrder += 10;

            $out[] = [
                'key' => $key,
                'name' => $name,
                'description' => $description === '' ? null : $description,
                'module' => TariffsExcelLabels::parseModule($this->cell($row, $col['Где показывается'])),
                'kind' => $kind,
                'price' => TariffsExcelLabels::parsePrice($this->cell($row, $col['Цена'])),
                'period' => TariffsExcelLabels::parsePeriod($this->cell($row, $col['Как часто платят'])),
                'prices_by_plan' => [
                    'free' => TariffsExcelLabels::parsePrice($this->cell($row, $col['Для Free'])),
                    'pro' => TariffsExcelLabels::parsePrice($this->cell($row, $col['Для PRO'])),
                    'premium' => TariffsExcelLabels::parsePrice($this->cell($row, $col['Для Premium'])),
                    'business' => TariffsExcelLabels::parsePrice($this->cell($row, $col['Для Business'])),
                ],
                'extras' => $this->parseExtras($this->cell($row, $col['Данные (JSON)'] ?? null), $line, $warnings),
                'is_active' => TariffsExcelLabels::parseActive($this->cell($row, $col['В продаже']), true),
                'sort_order' => $order,
            ];
        }

        return $out;
    }

    /**
     * Метка «ничей» в колонке тарифа: пусто или прочерк.
     *
     * @param mixed $value клетка «Тариф»
     */
    private function isHomelessMark(mixed $value): bool
    {
        $norm = TariffsExcelLabels::norm($value);

        return $norm === '' || $norm === '—' || $norm === '-';
    }

    /**
     * Служебный JSON из колонки «Данные (JSON)»: остатки payload.
     *
     * Пусто — пустой массив. Кривой JSON — предупреждение и пустой массив,
     * строка не падает: лучше потерять доп-данные одной строки, чем всю.
     *
     * @param mixed $value клетка «Данные (JSON)»
     * @param int $line номер строки для предупреждений
     * @param list<string> $warnings предупреждения
     * @return array<string, mixed>
     */
    private function parseExtras(mixed $value, int $line, array &$warnings): array
    {
        $text = trim((string) ($value ?? ''));

        if ($text === '') {
            return [];
        }

        $decoded = json_decode($text, true);

        if (! is_array($decoded)) {
            $warnings[] = "Витрина, строка {$line}: кривой JSON в «Данные» — доп-данные пропущены.";
            return [];
        }

        unset($decoded['prices_by_plan'], $decoded['plan'], $decoded['plans']);

        return $decoded;
    }

    /**
     * Привести ключ к виду [a-z0-9_.-]: пустой — сгенерировать, кривой — починить.
     *
     * @param mixed $raw сырая клетка «Ключ»
     * @param string $name название для генерации
     * @param string $prefix префикс генерации
     */
    private function cleanKey(mixed $raw, string $name, string $prefix): string
    {
        $key = trim((string) ($raw ?? ''));

        if ($key === '') {
            return TariffsExcelLabels::slugify($name.' '.substr(md5($name.microtime()), 0, 4), $prefix);
        }

        $key = mb_strtolower($key);
        $key = (string) preg_replace('/[^a-z0-9_.-]+/', '_', $key);
        $key = trim($key, '_.-');

        if (strlen($key) > 64) {
            $key = substr($key, 0, 64);
        }

        if ($key === '') {
            return TariffsExcelLabels::slugify($name, $prefix);
        }

        return $key;
    }

    /**
     * Длинный период файла в короткий период витрины.
     *
     * @param string $period monthly|yearly|weekly
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
