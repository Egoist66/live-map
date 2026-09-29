const LEGACY_MIRROR_KEY = 'upin_auth_token_mirror';

let memoryToken: string | null = null;

/**
 * Однократно удаляет legacy-зеркало токена из localStorage.
 *
 * Web живёт на HttpOnly cookie (Sanctum stateful), а зеркало осталось
 * от удалённого мобильного dual-auth и читалось любым XSS после reload.
 * Вызов безопасен на SSR (no-op без window).
 * Вызывать один раз при старте приложения (см. `useAppBoot`).
 *
 * @returns void
 */
export function purgeLegacyAuthMirror(): void {
    const hasWindow = typeof window !== 'undefined';

    if (!hasWindow) {
        return;
    }

    try {
        window.localStorage.removeItem(LEGACY_MIRROR_KEY);
    } catch {
        // Приватный режим / заблокированное хранилище — нечего чистить.
    }
}

/**
 * Читает токен синхронно (для axios/Echo интерсепторов).
 *
 * Только память: токен не переживает reload, поэтому украденный
 * через XSS скрипт не сможет переиспользовать его позже.
 * Web-авторизация при этом не ломается — она идёт по HttpOnly cookie
 * через `withCredentials: true`.
 *
 * @returns токен из памяти или null
 */
export function getStoredTokenSync(): string | null {
    return memoryToken;
}

/**
 * Хранилище auth-токена (только память).
 *
 * Web работает на cookie (Sanctum stateful), токен используется
 * только синхронными интерсепторами axios/Echo, если задан.
 * Persist в localStorage убран осознанно: любое JS-читаемое
 * хранилище доступно XSS, а API полностью покрыто cookie-сессией.
 *
 * @returns методы работы с токеном
 * @example
 * const { saveToken, clearToken } = useAuthStorage()
 * await saveToken(tokenFromApi)
 */
export function useAuthStorage() {
    async function saveToken(token: string): Promise<void> {
        memoryToken = token;
        purgeLegacyAuthMirror();

        try {
            window.dispatchEvent(new CustomEvent('upin:auth-changed'));
        } catch {
            // SSR / тесты без window — событие не шлём.
        }
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
        purgeLegacyAuthMirror();

        try {
            window.dispatchEvent(new CustomEvent('upin:auth-changed'));
        } catch {
            // SSR / тесты без window — событие не шлём.
        }
    }

    return { saveToken, loadToken, clearToken, getStoredTokenSync };
}
