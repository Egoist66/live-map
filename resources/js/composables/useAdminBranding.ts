import { computed, reactive, shallowRef } from 'vue'
import { useToast } from 'primevue/usetoast'
import type { FileUploadSelectEvent } from 'primevue/fileupload'
import { adminBrandingApi, type BrandingState } from '@/services/admin-branding.api'

/**
 * Реактивное состояние загрузки файлов брендинга.
 */
interface BrandingUiState {
  /** Идёт первичная загрузка данных. */
  loading: boolean
  /** Какой файл сейчас загружается или сбрасывается. */
  busy: 'app_icon' | 'favicon' | null
  /** Текст ошибки для inline-плашки. */
  error: string | null
  /** Текст последнего успешного действия. */
  notice: string | null
}

/**
 * Извлечь читаемое сообщение об ошибке из ответа Laravel.
 *
 * @param error Ошибка axios или любое исключение.
 * @param fallback Текст, если сервер не прислал сообщение.
 * @returns Сообщение для пользователя.
 */
function readError(error: unknown, fallback: string): string {
  const axiosError = error as { response?: { data?: { message?: string } } }
  const message = axiosError?.response?.data?.message

  return typeof message === 'string' && message.trim() !== '' ? message : fallback
}

/**
 * Управление иконкой приложения и favicon через админку.
 *
 * Хранит только состояние UI, сами URL приходят из `BrandingService`
 * и общих Inertia-пропсов. После загрузки возвращает свежие URL,
 * поэтому логотип и предпросмотр обновляются без перезагрузки.
 *
 * @returns Состояние, текущий брендинг и действия.
 *
 * @example
 * const { state, branding, load, handleAppIconSelect } = useAdminBranding()
 * onMounted(load)
 */
export function useAdminBranding() {
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  const branding = shallowRef<BrandingState | null>(null)
  const state = reactive<BrandingUiState>({
    loading: false,
    busy: null,
    error: null,
    notice: null,
  })

  const isLoading = computed(() => state.loading)
  const isBusy = computed(() => state.busy !== null)

  /**
   * Показать успешное уведомление.
   *
   * @param detail Текст для пользователя.
   */
  function showSuccess(detail: string): void {
    state.notice = detail
    toast?.add({
      severity: 'success',
      summary: 'Готово',
      detail,
      life: 2600,
    })
  }

  /**
   * Загрузить актуальное состояние брендинга.
   */
  async function load(): Promise<void> {
    if (state.loading) return

    state.loading = true
    state.error = null

    try {
      branding.value = await adminBrandingApi.show()
    } catch (error: unknown) {
      state.error = readError(error, 'Не удалось загрузить настройки брендинга.')
    } finally {
      state.loading = false
    }
  }

  /**
   * Загрузить иконку приложения.
   *
   * @param event Событие выбора файла PrimeVue FileUpload.
   */
  async function handleAppIconSelect(event: FileUploadSelectEvent): Promise<void> {
    await uploadFile('app_icon', event.files?.[0])
  }

  /**
   * Загрузить favicon.
   *
   * @param event Событие выбора файла PrimeVue FileUpload.
   */
  async function handleFaviconSelect(event: FileUploadSelectEvent): Promise<void> {
    await uploadFile('favicon', event.files?.[0])
  }

  /**
   * Сбросить файл к дефолтному.
   *
   * @param kind Тип файла.
   */
  async function reset(kind: 'app_icon' | 'favicon'): Promise<void> {
    if (state.busy !== null) return

    state.busy = kind
    state.error = null

    try {
      branding.value = await adminBrandingApi.reset(kind)
      showSuccess(kind === 'app_icon' ? 'Иконка приложения сброшена.' : 'Favicon сброшен.')
    } catch (error: unknown) {
      state.error = readError(error, 'Не удалось сбросить файл.')
    } finally {
      state.busy = null
    }
  }

  /**
   * Общая загрузка файла с валидацией на клиенте.
   *
   * @param kind Тип файла.
   * @param file Выбранный файл или undefined.
   */
  async function uploadFile(kind: 'app_icon' | 'favicon', file: File | undefined): Promise<void> {
    if (state.busy !== null) return

    if (!file) {
      state.error = 'Файл не выбран.'
      return
    }

    state.busy = kind
    state.error = null

    try {
      const apiKind = kind === 'app_icon' ? 'icon' : 'favicon'
      branding.value = await adminBrandingApi.upload(apiKind, file)
      showSuccess(kind === 'app_icon' ? 'Иконка приложения обновлена.' : 'Favicon обновлён.')
    } catch (error: unknown) {
      const fallback =
        kind === 'app_icon'
          ? 'Не удалось загрузить иконку. Нужен квадрат от 512×512 px (PNG, JPG или WebP).'
          : 'Не удалось загрузить favicon. Нужен ICO или PNG до 512 КБ.'
      state.error = readError(error, fallback)
    } finally {
      state.busy = null
    }
  }

  return {
    state,
    branding,
    isLoading,
    isBusy,
    load,
    handleAppIconSelect,
    handleFaviconSelect,
    reset,
  }
}
