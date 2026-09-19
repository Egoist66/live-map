import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { kvDel, kvGet, kvSet } from '@/db/app.db'
import { useImageCompress } from '@/composables/useImageCompress'

/**
 * Пресет фона чата.
 */
export type ChatWallpaperPreset = {
  id: string
  label: string
  css: string
}

/**
 * Встроенные градиентные фоны ленты сообщений.
 */
export const CHAT_WALLPAPER_PRESETS: ChatWallpaperPreset[] = [
  { id: 'default', label: 'Без фона', css: '' },
  { id: 'dusk', label: 'Сумерки', css: 'linear-gradient(160deg, #2b1055 0%, #7597de 100%)' },
  { id: 'sunset', label: 'Закат', css: 'linear-gradient(160deg, #ff9966 0%, #ff5e62 100%)' },
  { id: 'ocean', label: 'Океан', css: 'linear-gradient(160deg, #2193b0 0%, #6dd5ed 100%)' },
  { id: 'forest', label: 'Лес', css: 'linear-gradient(160deg, #134e5e 0%, #71b280 100%)' },
  { id: 'berry', label: 'Ягода', css: 'linear-gradient(160deg, #8e2de2 0%, #ff6a9f 100%)' },
  { id: 'graphite', label: 'Графит', css: 'linear-gradient(160deg, #232526 0%, #414345 100%)' },
]

/** Id пресета со своей картинкой пользователя. */
export const CUSTOM_WALLPAPER_ID = 'custom'

const MAX_WALLPAPER_SIDE = 1280
const MAX_WALLPAPER_BYTES = 700 * 1024

const activePresetId = ref<string>(CHAT_WALLPAPER_PRESETS[0].id)
const customImageUrl = ref<string | null>(null)
const isReady = ref(false)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

let ownerKey: string | null = null

/**
 * Фон ленты сообщений чата.
 *
 * Настройка персональная: хранится в IndexedDB под ключом
 * пользователя (`chat-wallpaper:{id}`), собеседник её не видит.
 * Своя картинка сжимается на клиенте, чтобы не раздувать базу.
 * Состояние общее для всех вызовов хука.
 *
 * @example
 * const wallpaper = useChatWallpaper()
 * await wallpaper.init()
 * await wallpaper.applyPreset('ocean')
 *
 * @returns состояние фона и действия
 */
export function useChatWallpaper() {
  const presets = CHAT_WALLPAPER_PRESETS
  const { compressImageFast } = useImageCompress()

  const hasWallpaper = computed(() => activePresetId.value !== CHAT_WALLPAPER_PRESETS[0].id)

  const isCustomActive = computed(() => activePresetId.value === CUSTOM_WALLPAPER_ID)

  const wallpaperLayerStyle = computed(() => {
    if (activePresetId.value === CUSTOM_WALLPAPER_ID && customImageUrl.value) {
      return {
        backgroundImage: `url("${customImageUrl.value}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    }
    const preset = presets.find((item) => item.id === activePresetId.value)
    if (!preset || !preset.css) {
      return {}
    }
    return { background: preset.css }
  })

  /**
   * Загружает сохранённый фон текущего пользователя.
   */
  async function init(): Promise<void> {
    if (isReady.value) {
      return
    }
    ownerKey = resolveOwnerKey()
    if (!ownerKey) {
      isReady.value = true
      return
    }
    try {
      const raw = await kvGet(ownerKey)
      if (!raw) {
        return
      }
      const saved = JSON.parse(raw) as { presetId?: string; customImage?: string | null }
      const known = presets.some((item) => item.id === saved.presetId)
      activePresetId.value = known ? String(saved.presetId) : CHAT_WALLPAPER_PRESETS[0].id
      const hasCustom = activePresetId.value === CUSTOM_WALLPAPER_ID && typeof saved.customImage === 'string'
      customImageUrl.value = hasCustom ? String(saved.customImage) : null
      if (activePresetId.value === CUSTOM_WALLPAPER_ID && !customImageUrl.value) {
        activePresetId.value = CHAT_WALLPAPER_PRESETS[0].id
      }
    } catch {
      activePresetId.value = CHAT_WALLPAPER_PRESETS[0].id
      customImageUrl.value = null
    } finally {
      isReady.value = true
    }
  }

  /**
   * Применяет встроенный пресет и сохраняет выбор.
   *
   * @param id id пресета
   */
  async function applyPreset(id: string): Promise<void> {
    const known = presets.some((item) => item.id === id)
    if (!known || id === CUSTOM_WALLPAPER_ID) {
      return
    }
    activePresetId.value = id
    saveError.value = null
    await persist()
  }

  /**
   * Сохраняет свою картинку как фон чата.
   *
   * @param file выбранный файл
   * @returns true когда фон применён
   */
  async function uploadCustom(file: File | null): Promise<boolean> {
    if (!file || !file.type.startsWith('image/')) {
      saveError.value = 'Выберите картинку'
      return false
    }
    isSaving.value = true
    saveError.value = null
    try {
      const compressed = await compressImageFast(file, MAX_WALLPAPER_SIDE, 0.78, MAX_WALLPAPER_BYTES)
      const url = await readFileAsDataUrl(compressed)
      customImageUrl.value = url
      activePresetId.value = CUSTOM_WALLPAPER_ID
      await persist()
      return true
    } catch {
      saveError.value = 'Не вышло сохранить фон, попробуйте другую картинку'
      return false
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Сбрасывает фон к стандартному и чистит хранилище.
   */
  async function resetWallpaper(): Promise<void> {
    activePresetId.value = CHAT_WALLPAPER_PRESETS[0].id
    customImageUrl.value = null
    saveError.value = null
    if (!ownerKey) {
      return
    }
    try {
      await kvDel(ownerKey)
    } catch {
      return
    }
  }

  /**
   * Пишет текущее состояние в IndexedDB под ключом пользователя.
   */
  async function persist(): Promise<void> {
    if (!ownerKey) {
      return
    }
    const payload = JSON.stringify({ presetId: activePresetId.value, customImage: customImageUrl.value })
    try {
      await kvSet(ownerKey, payload)
    } catch {
      saveError.value = 'Не вышло сохранить фон на этом устройстве'
    }
  }

  /**
   * Ключ хранилища для текущего пользователя.
   *
   * @returns ключ вида `chat-wallpaper:{id}` или null без юзера
   */
  function resolveOwnerKey(): string | null {
    try {
      const userId = Number((usePage().props as any)?.auth?.user?.id) || 0
      if (!(userId > 0)) {
        return null
      }
      return `chat-wallpaper:${userId}`
    } catch {
      return null
    }
  }

  /**
   * Читает файл как dataURL для хранения и показа.
   *
   * @param file сжатый файл картинки
   * @returns dataURL картинки
   */
  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('read failed'))
      reader.readAsDataURL(file)
    })
  }

  return {
    presets,
    activePresetId,
    customImageUrl,
    hasWallpaper,
    isCustomActive,
    wallpaperLayerStyle,
    isReady,
    isSaving,
    saveError,
    init,
    applyPreset,
    uploadCustom,
    resetWallpaper,
  }
}
