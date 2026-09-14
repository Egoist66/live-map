const MIRROR_KEY = 'upin_auth_token_mirror';

let memoryToken: string | null = null;

/**
 * Читает токен синхронно (для axios/Echo интерсепторов).
 *
 * @returns токен или null
 */
export function getStoredTokenSync(): string | null {
    if (memoryToken) {
        return memoryToken;
    }
    try {
        const mirrored = localStorage.getItem(MIRROR_KEY);
        if (mirrored) {
            memoryToken = mirrored;
            return mirrored;
        }
    } catch {
        // localStorage недоступен (SSR) — возвращаем null
    }
    return null;
}

/**
 * Хранилище auth-токена (localStorage-зеркало + память).
 *
 * Web работает на cookie (Sanctum stateful), токен используется
 * только синхронными интерсепторами axios/Echo, если задан.
 *
 * @returns методы работы с токеном
 * @example
 * const { saveToken, clearToken } = useAuthStorage()
 * await saveToken(tokenFromApi)
 */
export function useAuthStorage() {
    async function saveToken(token: string): Promise<void> {
        memoryToken = token;
        try {
            localStorage.setItem(MIRROR_KEY, token);
        } catch {}
        try {
            window.dispatchEvent(new CustomEvent('upin:auth-changed'));
        } catch {}
    }

    async function loadToken(): Promise<string | null> {
        const synced = getStoredTokenSync();
        if (synced) {
            return synced;
        }
        return null;
    }

    async function clearToken(): Promise<void> {
        memoryToken = null;
        try {
            localStorage.removeItem(MIRROR_KEY);
        } catch {}
        try {
            window.dispatchEvent(new CustomEvent('upin:auth-changed'));
        } catch {}
    }

    return { saveToken, loadToken, clearToken, getStoredTokenSync };
}
