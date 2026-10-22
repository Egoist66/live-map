<?php

namespace App\Http\Controllers;

use App\Services\BrandingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Админ-API брендинга: иконка приложения и favicon.
 *
 * Все маршруты закрыты middleware `admin` (см. routes/api.php).
 * Загрузка идёт multipart-ом, ответ всегда содержит актуальное
 * состояние с версионированными URL для мгновенного предпросмотра.
 */
class AdminBrandingController extends Controller
{
    /**
     * Отдать текущий брендинг.
     *
     * @return JsonResponse
     */
    public function show(): JsonResponse
    {
        return response()->json(BrandingService::state());
    }

    /**
     * Загрузить иконку приложения.
     *
     * Квадрат от 512px: из него строится логотип в интерфейсе,
     * манифест PWA и иконка установленного приложения.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function uploadAppIcon(Request $request): JsonResponse
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                'max:4096',
                'mimes:png,jpg,jpeg,webp',
                'dimensions:min_width=512,min_height=512,max_width=4096,max_height=4096,ratio=1/1',
            ],
        ], [
            'file.required' => 'Выберите файл иконки.',
            'file.max' => 'Файл слишком большой — максимум 4 МБ.',
            'file.mimes' => 'Подойдёт PNG, JPG или WebP.',
            'file.dimensions' => 'Нужна квадратная картинка от 512×512 px.',
        ]);

        return response()->json(BrandingService::storeAppIcon($request->file('file')));
    }

    /**
     * Загрузить favicon для вкладки браузера.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function uploadFavicon(Request $request): JsonResponse
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                'max:512',
                'extensions:ico,png',
                'mimetypes:image/x-icon,image/vnd.microsoft.icon,image/ico,image/png,application/octet-stream',
            ],
        ], [
            'file.required' => 'Выберите файл favicon.',
            'file.max' => 'Favicon слишком большой — максимум 512 КБ.',
            'file.extensions' => 'Подойдёт ICO или PNG.',
            'file.mimetypes' => 'Подойдёт ICO или PNG.',
        ]);

        return response()->json(BrandingService::storeFavicon($request->file('file')));
    }

    /**
     * Сбросить кастомную иконку или favicon.
     *
     * @param string $kind app_icon|favicon
     * @return JsonResponse
     */
    public function destroy(string $kind): JsonResponse
    {
        abort_unless(in_array($kind, ['app_icon', 'favicon'], true), 404);

        return response()->json(BrandingService::reset($kind));
    }
}
