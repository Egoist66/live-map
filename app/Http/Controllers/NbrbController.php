<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

class NbrbController extends Controller
{
    private string $base = 'https://api.nbrb.by/exrates';

    private function client()
    {
        return Http::timeout(10)->acceptJson();
    }

    private function remember(string $key, $ttl, callable $cb)
    {
        try {
            return Cache::remember($key, $ttl, $cb);
        } catch (Throwable) {
            return $cb();
        }
    }

    private function upstreamGet(string $url, array $params = [])
    {
        try {
            $res = $this->client()->get($url, $params);
        } catch (Throwable $e) {
            return [502, null, 'NBRB unavailable'];
        }
        if ($res->status() === 404) {
            return [404, null, null];
        }
        if (! $res->successful()) {
            return [502, null, 'NBRB error '.$res->status()];
        }
        $body = trim($res->body());
        if ($body === '') {
            return [200, [], null];
        }
        $json = $res->json();
        if ($json === null) {
            return [200, [], null];
        }
        return [200, $json, null];
    }

    private function keepParams(array $params): array
    {
        return array_filter($params, fn ($v) => $v !== null && $v !== '');
    }

    public function currencies(Request $request, ?int $curId = null)
    {
        $onlyActive = ! $request->boolean('all');
        $key = $curId ? "nbrb:currencies:{$curId}" : ($onlyActive ? 'nbrb:currencies:active' : 'nbrb:currencies:all');
        [$status, $data, $err] = $this->remember($key, now()->addHours(24), function () use ($curId, $onlyActive) {
            $url = $this->base.'/currencies'.($curId ? "/{$curId}" : '');
            [$s, $d, $e] = $this->upstreamGet($url);
            if ($s !== 200) {
                return [$s, $s === 404 ? ['__404' => true] : ['__502' => $e], $e];
            }
            if (! $curId && $onlyActive && is_array($d)) {
                $d = $this->activeOnly($d);
            }
            return [$s, $d, $e];
        });

        if (is_array($data) && ($data['__404'] ?? false)) {
            return response()->json(['message' => 'Currency not found'], 404);
        }
        if (is_array($data) && isset($data['__502'])) {
            return response()->json(['message' => $data['__502'] ?? 'NBRB unavailable'], 502);
        }
        if ($status === 502) {
            return response()->json(['message' => $err ?? 'NBRB unavailable'], 502);
        }

        return response()->json($data);
    }

    private function activeOnly(array $list): array
    {
        $today = date('Y-m-d');
        $byCode = [];
        foreach ($list as $c) {
            if (! is_array($c) || empty($c['Cur_Abbreviation'])) {
                continue;
            }
            $code = strtoupper($c['Cur_Abbreviation']);
            $end = substr($c['Cur_DateEnd'] ?? '', 0, 10);
            $active = $end === '' || $end > $today;
            if (! $active) {
                continue;
            }
            $prev = $byCode[$code] ?? null;
            if (! $prev || ($c['Cur_ID'] ?? 0) > ($prev['Cur_ID'] ?? 0)) {
                $byCode[$code] = $c;
            }
        }
        return array_values($byCode);
    }

    public function rates(Request $request, ?string $code = null)
    {
        $request->validate([
            'ondate' => ['nullable', 'date'],
            'periodicity' => ['nullable', 'in:0,1'],
            'parammode' => ['nullable', 'in:0,1,2'],
        ]);

        $params = $this->keepParams([
            'ondate' => $request->query('ondate'),
            'periodicity' => $request->query('periodicity', '0'),
            'parammode' => $request->query('parammode'),
        ]);

        $cacheKey = 'nbrb:rates:'.($code ?? 'all').':'.http_build_query($params);
        $ttl = isset($params['ondate']) ? now()->addDays(30) : now()->addHours(6);

        [$status, $data, $err] = $this->remember($cacheKey, $ttl, function () use ($code, $params) {
            $url = $this->base.'/rates'.($code ? "/{$code}" : '');
            [$s, $d, $e] = $this->upstreamGet($url, $params);
            if ($s === 404) {
                return [$s, ['__404' => true], $e];
            }
            if ($s !== 200) {
                return [$s, ['__502' => $e], $e];
            }
            return [$s, $d ?? [], $e];
        });

        if (is_array($data) && ($data['__404'] ?? false)) {
            return response()->json(['message' => 'Rate not found'], 404);
        }
        if (is_array($data) && isset($data['__502'])) {
            return response()->json(['message' => $data['__502'] ?? 'NBRB unavailable'], 502);
        }

        return response()->json($data ?? []);
    }

    public function dynamics(Request $request, int $curId)
    {
        $request->validate([
            'startdate' => ['required', 'date'],
            'enddate' => ['required', 'date'],
        ]);

        $start = new \DateTime($request->query('startdate'));
        $end = new \DateTime($request->query('enddate'));
        if ($start > $end || $start->diff($end)->days > 365) {
            return response()->json(['message' => 'Period must be <= 365 days, startdate <= enddate'], 422);
        }

        $key = "nbrb:dynamics:{$curId}:{$request->query('startdate')}:{$request->query('enddate')}";
        [$status, $data, $err] = $this->remember($key, now()->addHours(12), function () use ($curId, $request) {
            [$s, $d, $e] = $this->upstreamGet("{$this->base}/rates/dynamics/{$curId}", [
                'startdate' => $request->query('startdate'),
                'enddate' => $request->query('enddate'),
            ]);
            if ($s === 404) {
                return [$s, ['__404' => true], $e];
            }
            if ($s !== 200) {
                return [$s, ['__502' => $e], $e];
            }
            return [$s, $d ?? [], $e];
        });

        if (is_array($data) && ($data['__404'] ?? false)) {
            return response()->json(['message' => 'Currency not found'], 404);
        }
        if (is_array($data) && isset($data['__502'])) {
            return response()->json(['message' => $data['__502'] ?? 'NBRB unavailable'], 502);
        }

        return response()->json($data ?? []);
    }

    public function convert(Request $request)
    {
        $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'from' => ['nullable', 'string', 'max:10'],
            'ondate' => ['nullable', 'date'],
        ]);

        $from = strtoupper($request->query('from', 'USD'));
        $amount = (float) $request->query('amount');
        $ondate = $request->query('ondate');

        $parammode = is_numeric($from) ? 1 : 2;
        $key = "nbrb:convert:{$from}:".($ondate ?? 'today');
        [$status, $rate, $err] = $this->remember($key, $ondate ? now()->addDays(30) : now()->addHours(6), function () use ($from, $parammode, $ondate) {
            $params = $this->keepParams(['parammode' => $parammode, 'ondate' => $ondate]);
            [$s, $d, $e] = $this->upstreamGet("{$this->base}/rates/{$from}", $params);
            if ($s !== 200 || ! is_array($d) || ! isset($d['Cur_OfficialRate'])) {
                return [$s, null, $e];
            }
            return [$s, $d, $e];
        });

        if (! is_array($rate) || ! isset($rate['Cur_OfficialRate'])) {
            $code = $status === 502 ? 502 : 404;
            return response()->json(['message' => $code === 502 ? ($err ?? 'NBRB unavailable') : 'Rate not found for '.$from], $code);
        }

        $perUnit = $rate['Cur_OfficialRate'] / $rate['Cur_Scale'];
        $byn = round($amount * $perUnit, 2);

        return response()->json([
            'from' => $rate['Cur_Abbreviation'],
            'cur_id' => $rate['Cur_ID'],
            'cur_name' => $rate['Cur_Name'],
            'cur_scale' => $rate['Cur_Scale'],
            'official_rate' => $rate['Cur_OfficialRate'],
            'per_unit' => $perUnit,
            'date' => $rate['Date'],
            'amount' => $amount,
            'byn' => $byn,
        ]);
    }
}
