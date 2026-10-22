import { api } from './api'

/**
 * Публичный файл брендинга.
 */
export interface BrandingAsset {
  /** Версионированный URL файла. */
  url: string
  /** Загружен ли файл через админку. */
  is_custom: boolean
}

/**
 * Состояние брендинга из `BrandingService`.
 */
export interface BrandingState {
  /** Иконка приложения (логотип, PWA, apple-touch). */
  app_icon: BrandingAsset
  /** Favicon вкладки браузера. */
  favicon: BrandingAsset
  /** Общая версия для сброса кэша манифеста. */
  version: string
}

/**
 * API управления брендингом в админке.
 *
 * @example
 * const state = await adminBrandingApi.show()
 */
export const adminBrandingApi = {
  /**
   * Получить актуальное состояние.
   *
   * @returns Текущие URL и флаги кастомных файлов.
   */
  async show(): Promise<BrandingState> {
    const { data } = await api.get('/api/admin/branding')
    return data as BrandingState
  },

  /**
   * Загрузить иконку приложения или favicon.
   *
   * @param kind Тип файла: иконка приложения или favicon.
   * @param file Выбранный файл.
   * @returns Обновлённое состояние брендинга.
   */
  async upload(kind: 'icon' | 'favicon', file: File): Promise<BrandingState> {
    const form = new FormData()
    form.append('file', file)

    const endpoint = kind === 'icon' ? '/api/admin/branding/icon' : '/api/admin/branding/favicon'
    const { data } = await api.post(endpoint, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return data as BrandingState
  },

  /**
   * Сбросить кастомный файл к дефолтному.
   *
   * @param kind Тип файла: `app_icon` или `favicon`.
   * @returns Обновлённое состояние брендинга.
   */
  async reset(kind: 'app_icon' | 'favicon'): Promise<BrandingState> {
    const { data } = await api.delete(`/api/admin/branding/${kind}`)
    return data as BrandingState
  },
}
