<?php

namespace App\Http\Controllers;

use App\Services\SeoSettingsService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Публичные SEO-эндпоинты: robots.txt и sitemap.xml.
 *
 * Содержимое строится через SeoSettingsService, поэтому всё, что админ
 * меняет в панели SEO (режим robots, исключения sitemap, доп. URL),
 * применяется мгновенно без правки кода.
 */
class SeoController extends Controller
{
    /**
     * Отдать robots.txt.
     *
     * @param Request $request текущий запрос
     * @return Response текстовый ответ
     */
    public function robots(Request $request): Response
    {
        $base = rtrim(config('app.url'), '/');
        $isProd = app()->environment('production');

        $content = SeoSettingsService::buildRobots($base, $isProd);

        return response($content, 200)->header('Content-Type', 'text/plain');
    }

    /**
     * Отдать sitemap.xml.
     *
     * @return Response XML-ответ
     */
    public function sitemap(): Response
    {
        $base = rtrim(config('app.url'), '/');
        $now = now()->toAtomString();

        if (! SeoSettingsService::sitemap()['enabled']) {
            abort(404);
        }

        $urls = SeoSettingsService::buildSitemapUrls($base);

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($urls as $u) {
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$u['loc']}</loc>\n";
            $xml .= "    <lastmod>{$now}</lastmod>\n";
            $xml .= "    <changefreq>{$u['changefreq']}</changefreq>\n";
            $xml .= "    <priority>{$u['priority']}</priority>\n";
            $xml .= "  </url>\n";
        }
        $xml .= '</urlset>';

        return response($xml, 200)->header('Content-Type', 'application/xml');
    }
}
