<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class NbrbController extends Controller
{
    private string $base = 'https://api.nbrb.by/exrates';

    private function client()
    {
        return Http::timeout(10)->acceptJson();
    }

    public function currencies(?int $curId = null)
    {
        $key = $curId ? "nbrb:currencies:{$curId}" : 'nbrb:currencies:all';
        $data = Cache::remember($key, now()->addHours(24), function () use ($curId) {
            $url = $this->base.'/currencies'.($curId ? "/{$curId}" : '');
            $res = $this->client()->get($url);
            if ($res->status() === 404) {
                return ['__404' => true];
            }
            $res->throw();
            return $res->json();
        });

        if (is_array($data) && ($data['__404'] ?? false)) {
            return response()->json(['message' => 'Currency not found'], 404);
        }

        return response()->json($data);
    }

    public function rates(Request $request, ?string $code = null)
    {
        $request->validate([
            'ondate' => ['nullable', 'date'],
            'periodicity' => ['nullable', 'in:0,1'],
            'parammode' => ['nullable', 'in:0,1,2'],
        ]);

        $params = array_filter([
            'ondate' => $request->query('ondate'),
            'periodicity' => $request->query('periodicity', '0'),
            'parammode' => $request->query('parammode'),
        ]);

        $cacheKey = 'nbrb:rates:'.($code ?? 'all').':'.http_build_query($params);
        $ttl = isset($params['ondate']) ? now()->addDays(30) : now()->addHours(6);

        $data = Cache::remember($cacheKey, $ttl, function () use ($code, $params) {
            $url = $this->base.'/rates'.($code ? "/{$code}" : '');
            $res = $this->client()->get($url, $params);
            if ($res->status() === 404) {
                return ['__404' => true];
            }
            $res->throw();
            return $res->json() ?? [];
        });

        if (is_array($data) && ($data['__404'] ?? false)) {
            return response()->json(['message' => 'Rate not found'], 404);
        }

        return response()->json($data);
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
        $data = Cache::remember($key, now()->addHours(12), function () use ($curId, $request) {
            $res = $this->client()->get("{$this->base}/rates/dynamics/{$curId}", [
                'startdate' => $request->query('startdate'),
                'enddate' => $request->query('enddate'),
            ]);
            if ($res->status() === 404) {
                return ['__404' => true];
            }
            $res->throw();
            return $res->json() ?? [];
        });

        if (is_array($data) && ($data['__404'] ?? false)) {
            return response()->json(['message' => 'Currency not found'], 404);
        }

        return response()->json($data);
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
        $rate = Cache::remember($key, $ondate ? now()->addDays(30) : now()->addHours(6), function () use ($from, $parammode, $ondate) {
            $params = array_filter(['parammode' => $parammode, 'ondate' => $ondate]);
            $res = $this->client()->get("{$this->base}/rates/{$from}", $params);
            if ($res->status() === 404 || blank($res->body())) {
                return null;
            }
            $res->throw();
            return $res->json();
        });

        if (! $rate) {
            return response()->json(['message' => 'Rate not found for '.$from], 404);
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
