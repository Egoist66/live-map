<?php

namespace App\Exports\Sheets;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Лист «Как пользоваться»: обложка файла и легенда цветов.
 *
 * Объясняет за 30 секунд: что на каком листе, какие слова писать в ценах,
 * что будет при загрузке обратно, куда нажимать в админке. Ссылки на листы —
 * кликабельные (внутренние гиперссылки), цвета легенды совпадают с файлом.
 */
class TariffsGuideSheet implements FromArray, WithTitle, WithColumnWidths, WithEvents
{
    /**
     * Название вкладки.
     */
    public function title(): string
    {
        return 'Как пользоваться';
    }

    /**
     * Ширина колонок.
     *
     * @return array<string, float|int>
     */
    public function columnWidths(): array
    {
        return [
            'A' => 26,
            'B' => 78,
        ];
    }

    /**
     * Строки инструкции (две колонки: шаг → текст).
     *
     * @return list<array<int, string>>
     */
    public function array(): array
    {
        return [
            ['Файл', 'Тарифы, возможности и витрина на сегодня. Это и выгрузка, и шаблон для загрузки обратно.'],
            ['Лист «Тарифы»', 'Названия, описания и 3 цены каждого тарифа (месяц, год, неделя — одна цена для всех стран). Правите — загружаете файл обратно, цены встают везде: в приложении и в боте.'],
            ['Лист «Что входит»', 'Строки внутри карточек тарифов. Колонка «Тариф» — куда положить, «Показывается» — да/нет. Новая строка = пустой «Ключ».'],
            ['Лист «Витрина»', 'Разовые товары: кредиты и реклама. «В продаже» — да/нет, «Как всем» — обычная цена.'],
            ['Цены', 'Число (3.99) — платное. «Бесплатно» / «Нет» / «Как всем» / пусто — бесплатно или обычная цена. Знак $ ставить не нужно.'],
            ['Серые «Ключи»', 'Технические ключи (латиница). У старых строк не меняйте — иначе строка задвоится. У новых оставьте пусто.'],
            ['Списки', 'Во всех важных колонках есть стрелочка-список: раздел, вид, период, да/нет. Выбирайте из него — файл загрузится без ошибок.'],
            ['Загрузка обратно', 'В админке «Тарифы» → кнопка «Загрузить Excel». Без галочки «Очистить» — строки обновятся по ключам, новое добавится. С галочкой — всё удалится и загрузится только из файла.'],
            ['Если всё удалили', 'Ничего страшного: загрузите этот файл с галочкой «Очистить» — тарифы, цены, фишки, описания и товары восстановятся.'],
            ['Цвета', 'Смотрите легенду ниже: цвета тарифов и статусов совпадают с остальными листами.'],
            ['', ''],
            ['Легенда', 'Что значит каждый цвет в файле'],
            ['Free', 'Серый — бесплатный тариф'],
            ['PRO', 'Зелёный — активный платный тариф'],
            ['Premium', 'Фиолетовый — максимальный тариф'],
            ['Business', 'Янтарный — тариф для компаний'],
            ['да / в продаже', 'Зелёный — видно людям, продаётся'],
            ['нет / скрыто', 'Красный — скрыто, но не удалено'],
            ['Серый ключ', 'Техническая колонка — лучше не трогать'],
            ['Изменены вручную', 'Янтарный статус — цену правили в админке, а не в конфиге'],
        ];
    }

    /**
     * Оформление: заголовок, ссылки, легенда цветом.
     *
     * @return array<string, callable>
     */
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event): void {
                $sheet = $event->sheet->getDelegate();

                $sheet->freezePane('A1');
                $sheet->getTabColor()->setRGB('64748B');
                $sheet->getPageSetup()->setFitToPage(true);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setFitToHeight(1);
                $sheet->getPageSetup()->setOrientation('portrait');
                $sheet->getSheetView()->setZoomScale(100);

                $sheet->getStyle('A1:B10')->getAlignment()->setVertical('center');
                $sheet->getStyle('B1:B10')->getAlignment()->setWrapText(true);

                foreach (range(1, 10) as $row) {
                    $sheet->getRowDimension($row)->setRowHeight(30);
                }

                foreach (range(12, 20) as $row) {
                    $sheet->getRowDimension($row)->setRowHeight(24);
                }

                $sheet->getStyle('A1:A10')->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['rgb' => '0F172A']],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F1F5F9']],
                    'alignment' => ['horizontal' => 'left', 'vertical' => 'center'],
                ]);

                $sheet->getStyle('A12:B12')->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '0F172A']],
                ]);

                $legendFills = [
                    13 => 'E2E8F0',
                    14 => 'D1FAE5',
                    15 => 'EDE9FE',
                    16 => 'FEF3C7',
                    17 => 'D1FAE5',
                    18 => 'FEE2E2',
                    19 => 'F1F5F9',
                    20 => 'FEF3C7',
                ];

                foreach ($legendFills as $row => $fill) {
                    $sheet->getStyle("A{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $fill]],
                        'font' => ['bold' => true],
                        'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
                    ]);

                    $sheet->getStyle("B{$row}")->getAlignment()->setVertical('center');
                }

                $this->addSheetLinks($sheet);
            },
        ];
    }

    /**
     * Кликабельные ссылки на остальные листы.
     *
     * @param Worksheet $sheet лист
     */
    private function addSheetLinks(Worksheet $sheet): void
    {
        $links = [
            'B2' => "'Тарифы'!A1",
            'B3' => "'Что входит'!A1",
            'B4' => "'Витрина'!A1",
        ];

        foreach ($links as $cell => $target) {
            $cellObject = $sheet->getCell($cell);
            $cellObject->getHyperlink()->setUrl("sheet://{$target}");
            $cellObject->getHyperlink()->setTooltip("Перейти: {$target}");

            $sheet->getStyle($cell)->applyFromArray([
                'font' => ['color' => ['rgb' => '2563EB'], 'underline' => 'single'],
            ]);
        }

        $sheet->getStyle('B1:B10')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
    }
}
