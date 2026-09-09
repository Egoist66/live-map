<?php

namespace App\Http\Controllers;

use App\Models\ReferencePage;
use Illuminate\Http\Request;

/**
 * Публичное чтение справочных страниц.
 */
class ReferencePageController extends Controller
{
    /**
     * Список опубликованных страниц.
     */
    public function index()
    {
        $pages = ReferencePage::query()
            ->published()
            ->orderBy('slug')
            ->get(['id', 'slug', 'title', 'updated_at']);

        return response()->json($pages);
    }

    /**
     * Одна опубликованная страница по слагу.
     *
     * @throws \Symfony\Component\HttpKernel\Exception\NotFoundHttpException
     */
    public function show(string $slug)
    {
        $page = ReferencePage::query()
            ->published()
            ->bySlug($slug)
            ->first();

        abort_if(! $page, 404);

        return response()->json($page);
    }
}
