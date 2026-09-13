import { Preferences } from '@capacitor/preferences';
import { usePlatform } from '@/composables/usePlatform';

const TOKEN_KEY = 'upin_auth_token';
const MIRROR_KEY = 'upin_auth_token_mirror';

let memoryToken: string | null = null;

/**
 * Читает токен синхронно (для axios/Echo интерсепторов).
 *
 * Натив пишет токен и в Preferences, и в localStorage-зеркало,
 * поэтому синхронное чтение не теряет токен после рестарта WebView.
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
 * Хранилище auth-токена для натива.
 *
 * Web продолжает работать на cookie (Sanctum stateful) как сейчас —
 * токен там не используется. Натив хранит Bearer-токен в Preferences
 * (+ зеркало в localStorage для синхронных интерсепторов).
 *
 * @returns методы работы с токеном
 * @example
 * const { saveToken, clearToken } = useAuthStorage()
 * await saveToken(tokenFromApi)
 */
export function useAuthStorage() {
    const { isNative } = usePlatform();

    async function saveToken(token: string): Promise<void> {
        memoryToken = token;
        try {
            localStorage.setItem(MIRROR_KEY, token);
        } catch {}
        if (isNative) {
            await Preferences.set({ key: TOKEN_KEY, value: token });
        }
    }

    async function loadToken(): Promise<string | null> {
        const synced = getStoredTokenSync();
        if (synced) {
            return synced;
        }
        if (!isNative) {
            return null;
        }
        const stored = await Preferences.get({ key: TOKEN_KEY });
        if (stored.value) {
            memoryToken = stored.value;
            try {
                localStorage.setItem(MIRROR_KEY, stored.value);
            } catch {}
            return stored.value;
        }
        return null;
    }

    async function clearToken(): Promise<void> {
        memoryToken = null;
        try {
            localStorage.removeItem(MIRROR_KEY);
        } catch {}
        if (isNative) {
            await Preferences.remove({ key: TOKEN_KEY });
        }
    }

    return { saveToken, loadToken, clearToken, getStoredTokenSync };
}
