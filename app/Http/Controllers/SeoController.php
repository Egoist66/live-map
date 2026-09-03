<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\URL;

class SeoController extends Controller
{
    public function robots(Request $request): Response
    {
        $base = rtrim(config('app.url'), '/');
        $isProd = app()->environment('production');

        if (!$isProd) {
            $content = "User-agent: *\nDisallow: /\n";
            return response($content, 200)->header('Content-Type', 'text/plain');
        }

        $content = implode("\n", [
            "User-agent: *",
            "Allow: /",
            "Disallow: /admin",
            "Disallow: /dashboard",
            "Disallow: /profile",
            "Disallow: /chat",
            "Disallow: /settings",
            "Disallow: /api/",
            "Disallow: /*?*",
            "Disallow: /login",
            "Disallow: /register",
            "Crawl-delay: 1",
            "",
            "Sitemap: {$base}/sitemap.xml",
        ]);

        return response($content, 200)->header('Content-Type', 'text/plain');
    }

    public function sitemap(): Response
    {
        $base = rtrim(config('app.url'), '/');
        $now = now()->toAtomString();

        $urls = [
            ['loc' => $base.'/', 'priority' => '1.0', 'changefreq' => 'daily'],
            ['loc' => $base.'/faq', 'priority' => '0.8', 'changefreq' => 'weekly'],
            ['loc' => $base.'/map', 'priority' => '0.9', 'changefreq' => 'hourly'],
            ['loc' => $base.'/login', 'priority' => '0.3', 'changefreq' => 'monthly'],
            ['loc' => $base.'/register', 'priority' => '0.5', 'changefreq' => 'monthly'],
        ];

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
