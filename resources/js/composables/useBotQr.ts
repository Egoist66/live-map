import { computed, ref } from 'vue'
import { useTelegramNotifications } from '@/composables/useTelegramNotifications'
import { useTelegram } from '@/composables/useTelegram'

/** Путь к QR-коду бота в `public/images/bot_qr.png`. */
export const BOT_QR_SRC = '/images/bot_qr.png'

const qrFailed = ref(false)

/**
 * QR-код Telegram-бота для настроек: сканируешь камерой — открывается бот,
 * клик/тап по коду — тоже открывает бота (внутри TG через WebApp, снаружи
 * в новой вкладке).
 *
 * Вся логика здесь (Правило №1): компоненты только рисуют картинку
 * и дёргают `openBot`. Состояние `qrFailed` общее — если файл не
 * загрузился, все места дружно показывают текстовую ссылку-запасной вариант.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useBotQr } from '@/composables/useBotQr'
 * const qr = useBotQr()
 * </script>
 * <template>
 *   <button v-if="!qr.qrFailed.value" type="button" @click="qr.openBot()">
 *     <img :src="qr.qrSrc" alt="QR-код Telegram-бота" />
 *   </button>
 *   <a v-else :href="qr.botLink.value" target="_blank" rel="noopener">{{ qr.botLink.value }}</a>
 * </template>
 * ```
 *
 * @returns src QR, ссылка и имя бота, флаг битой картинки, методы
 */
export function useBotQr() {
  const tg = useTelegramNotifications()
  const { openLink } = useTelegram()

  const qrSrc = BOT_QR_SRC
  const botLink = computed(() => tg.botLink.value)
  const botUsername = computed(() => tg.botUsername.value)

  /**
   * Открыть бота по клику/тапу на QR-код.
   */
  function openBot(): void {
    openLink(botLink.value)
  }

  /**
   * Пометить QR как битый (обработчик `@error` у `<img>`).
   */
  function markQrFailed(): void {
    qrFailed.value = true
  }

  return { qrSrc, botLink, botUsername, qrFailed, openBot, markQrFailed, loadTelegramNotify: tg.loadTelegramNotify }
}
