<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * ICE-конфиг для WebRTC: STUN всегда + TURN когда настроен.
 *
 * Без своего TURN ~30% звонков за симметричным NAT/мобильными сетями
 * не встают: сигналинг проходит (звонок принимается), а медиа нет —
 * чёрный экран и тишина. На Laravel Cloud свой coturn не поднять
 * (нет UDP-портов), поэтому поддерживаются три режима:
 *
 * - static: TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL
 *   (свой coturn на VPS или Metered.ca / Xirsys — вставляешь выданное);
 * - coturn REST: TURN_URLS + TURN_SECRET — временные креды по HMAC,
 *   логин не светится в VITE_ env;
 * - cloudflare: CF_TURN_KEY_ID + CF_TURN_API_TOKEN — временные креды
 *   через Calls TURN API, кэшируются на TTL ответа.
 *
 * Легаси VITE_TURN_* читаются как фолбэк, чтобы не уронить прод
 * до переезда на серверные переменные.
 */
class TurnService
{
    /** Публичные STUN — дефолт, когда TURN не настроен. */
    public const STUN_SERVERS = [
        ['urls' => ['stun:stun.l.google.com:19302']],
        ['urls' => ['stun:stun1.l.google.com:19302']],
        ['urls' => ['stun:stun.cloudflare.com:3478']],
    ];

    /** На сколько выдаём coturn REST-креды. */
    public const COTURN_TTL_SEC = 86400;

    /** Кэш Cloudflare-кредов (их TTL обычно 24ч, берём с запасом). */
    public const CF_CACHE_SEC = 43200;

    /**
     * Собрать ICE-конфиг для клиента.
     *
     * @param int|null $userId id звонящего (для персональных REST-кредов)
     * @return array{iceServers: array, turnConfigured: bool, ttl: int}
     */
    public function iceConfig(?int $userId = null): array
    {
        $stun = self::STUN_SERVERS;

        $cloudflare = $this->cloudflareServers();
        if ($cloudflare !== null) {
            $merged = array_merge($stun, $cloudflare['servers']);

            return [
                'iceServers' => $merged,
                'turnConfigured' => true,
                'ttl' => $cloudflare['ttl'],
            ];
        }

        $static = $this->staticServers($userId);
        if ($static !== null) {
            $merged = array_merge($stun, [$static]);

            return [
                'iceServers' => $merged,
                'turnConfigured' => true,
                'ttl' => self::COTURN_TTL_SEC,
            ];
        }

        return [
            'iceServers' => $stun,
            'turnConfigured' => false,
            'ttl' => 3600,
        ];
    }

    /**
     * Статика или coturn REST (временные креды по секрету).
     *
     * @param int|null $userId id звонящего (суффикс REST-юзера для аудита)
     * @return array{urls: array, username?: string, credential?: string}|null
     */
    private function staticServers(?int $userId = null): ?array
    {
        $urls = $this->envFirst(['TURN_URLS', 'VITE_TURN_URLS']);
        if ($urls === '') {
            return null;
        }

        $parsed = $this->parseUrls($urls);
        if ($parsed === []) {
            return null;
        }

        $secret = $this->envFirst(['TURN_SECRET']);

        if ($secret !== '') {
            $ttl = self::COTURN_TTL_SEC;
            $expiry = time() + $ttl;
            $suffix = $userId ? ('u' . $userId) : 'upin';
            $username = $expiry . ':' . $suffix;
            $credential = $this->coturnCredential($secret, $username);

            return [
                'urls' => $parsed,
                'username' => $username,
                'credential' => $credential,
            ];
        }

        $username = $this->envFirst(['TURN_USERNAME', 'VITE_TURN_USERNAME']);
        $credential = $this->envFirst(['TURN_CREDENTIAL', 'VITE_TURN_CREDENTIAL']);

        if ($username === '' || $credential === '') {
            return null;
        }

        return [
            'urls' => $parsed,
            'username' => $username,
            'credential' => $credential,
        ];
    }

    /**
     * Cloudflare Calls TURN: временные креды через API с кэшем.
     *
     * @return array{servers: array, ttl: int}|null
     */
    private function cloudflareServers(): ?array
    {
        $keyId = trim((string) env('CF_TURN_KEY_ID', ''));
        $token = trim((string) env('CF_TURN_API_TOKEN', ''));
        $ttlHours = (int) env('CF_TURN_TTL_HOURS', 24);

        if ($keyId === '' || $token === '') {
            return null;
        }

        $ttlHours = max(1, min($ttlHours, 48));
        $cacheKey = 'turn:cloudflare:' . sha1($keyId . ':' . $ttlHours);

        $cached = Cache::get($cacheKey);
        if (is_array($cached) && isset($cached['servers'])) {
            return $cached;
        }

        $url = 'https://rtc.live.cloudflare.com/v1/turn/keys/'
            . $keyId
            . '/credentials/generate';

        try {
            $response = Http::withToken($token)
                ->timeout(8)
                ->post($url, ['ttl' => $ttlHours * 3600]);
        } catch (\Throwable $e) {
            Log::warning('turn.cf_unreachable', ['err' => $e->getMessage()]);

            return null;
        }

        if (! $response->successful()) {
            Log::warning('turn.cf_failed', ['status' => $response->status()]);

            return null;
        }

        $data = $response->json();
        $servers = $data['iceServers'] ?? null;

        if (! is_array($servers) || $servers === []) {
            return null;
        }

        $result = [
            'servers' => $servers,
            'ttl' => $ttlHours * 3600,
        ];

        Cache::put($cacheKey, $result, self::CF_CACHE_SEC);

        return $result;
    }

    /**
     * Откуда взяли значение при последнем чтении (для админ-диагностики
     * в iceServers: видно, доехал ли env до рантайма или смотрим в кэш).
     *
     * @var array<string, string>
     */
    private array $sources = [];

    /**
     * Первая непустая переменная из списка.
     *
     * Порядок: живой env рантайма → config (запечён config:cache при старте
     * контейнера, когда env уже на месте) → пусто. Легаси VITE_* живут
     * только в env и подхватываются той же очередью.
     *
     * @param string[] $names имена переменных
     * @return string значение или пустая строка
     */
    private function envFirst(array $names): string
    {
        foreach ($names as $name) {
            $value = trim((string) env($name, ''));
            if ($value !== '') {
                $this->sources[$name] = 'env';
                return $value;
            }
            $key = $this->configKey($name);
            if ($key !== null) {
                $fromConfig = trim((string) config($key, ''));
                if ($fromConfig !== '') {
                    $this->sources[$name] = 'config';
                    return $fromConfig;
                }
            }
        }

        $this->sources[$names[0]] = 'none';

        return '';
    }

    /**
     * Ключ config/services.php для серверной переменной (VITE_* — только env).
     *
     * @param string $name имя переменной
     * @return string|null ключ конфига или null когда его нет
     */
    private function configKey(string $name): ?string
    {
        return match ($name) {
            'TURN_URLS' => 'services.turn.urls',
            'TURN_USERNAME' => 'services.turn.username',
            'TURN_CREDENTIAL' => 'services.turn.credential',
            'TURN_SECRET' => 'services.turn.secret',
            default => null,
        };
    }

    /**
     * Диагностика источников (только факты наличия, без самих секретов).
     *
     * @return array{urls_from:string,auth_from:string}
     */
    public function debugSources(): array
    {
        return [
            'urls_from' => $this->sources['TURN_URLS'] ?? $this->sources['VITE_TURN_URLS'] ?? 'none',
            'auth_from' => $this->sources['TURN_SECRET'] ?? $this->sources['TURN_USERNAME'] ?? 'none',
        ];
    }

    /**
     * Разобрать строку URL через запятую в массив.
     *
     * @param string $raw строка вида "turn:host:3478?transport=udp,turns:..."
     * @return string[]
     */
    private function parseUrls(string $raw): array
    {
        $parts = explode(',', $raw);

        $cleaned = array_map(
            static fn (string $part): string => trim($part),
            $parts
        );

        return array_values(array_filter($cleaned));
    }

    /**
     * HMAC-кред для coturn REST API (RFC: password = base64(hmac_sha1(secret, username))).
     *
     * @param string $secret общий секрет из turnserver.conf (static-auth-secret)
     * @param string $username метка вида "expiry:user"
     * @return string пароль для RTCIceServer.credential
     */
    private function coturnCredential(string $secret, string $username): string
    {
        $hmac = hash_hmac('sha1', $username, $secret, true);

        return base64_encode($hmac);
    }

}
