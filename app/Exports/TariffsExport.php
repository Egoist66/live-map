<?php

namespace App\Exports;

use App\Exports\Sheets\TariffsFeaturesSheet;
use App\Exports\Sheets\TariffsGuideSheet;
use App\Exports\Sheets\TariffsPlansSheet;
use App\Exports\Sheets\TariffsShowcaseSheet;
use Maatwebsite\Excel\Concerns\Export;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Выгрузка тарифов в Excel через maatwebsite/excel.
 *
 * Четыре листа: «Как пользоваться» (обложка + легенда + ссылки),
 * «Тарифы» (цены и описания), «Что входит» (фишки по тарифам),
 * «Витрина» (товары с ценами под тарифы). Файл — он же шаблон для
 * обратной загрузки: технические ключи позволяют импорту обновить
 * строки, а не задвоить их.
 */
class TariffsExport implements Export, WithMultipleSheets
{
    /**
     * Листы книги по порядку вкладок.
     *
     * @return list<object>
     */
    public function sheets(): array
    {
        return [
            new TariffsGuideSheet(),
            new TariffsPlansSheet(),
            new TariffsFeaturesSheet(),
            new TariffsShowcaseSheet(),
        ];
    }
}
