import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useBusinessStore } from '@/stores/business'
import { useTheme } from '@/composables/useTheme'
import { usePush } from '@/composables/usePush'
import { usePwaSettings } from '@/composables/usePwaSettings'
import { usePwaInstallGuide } from '@/composables/usePwaInstallGuide'
import { useCoverCropper } from '@/composables/useCoverCropper'
import { MAX_PHOTO_INPUT_BYTES } from '@/utils/image'

const LEGAL_FORM_LABELS: Record<string, string> = {
  ooo: 'ООО',
  ip: 'ИП',
  odo: 'ОДО',
  zao: 'ЗАО',
  self_employed: 'Самозанятый',
  craft: 'Ремесленник',
  other: 'Другое',
}

/**
 * Фасад настроек бизнеса: компания, тариф, уведомления, вид, приложение.
 *
 * Только бизнес-сущности — никаких персональных разделов
 * (свайпы, знакомства, режимы персоны).
 *
 * @returns стор, тема, пуши, PWA и подписи форм
 * @example const settings = useBusinessSettings()
 */
export function useBusinessSettings() {
  const store = useBusinessStore()
  const theme = useTheme()
  const push = usePush()
  const pwa = usePwaSettings()
  const guide = usePwaInstallGuide()
  const toast = useToast()

  const profile = computed(() => store.profile)
  const isVerified = computed(() => store.profile?.verification_status === 'verified')
  const coverCrop = useCoverCropper()

  /** Черновик бренда для карточки «Компания» в настройках. */
  const brandDraft = ref('')
  const brandTouched = ref(false)

  watch(
    () => store.profile?.brand ?? '',
    (brand) => {
      if (!brandTouched.value) {
        brandDraft.value = brand
      }
    },
    { immediate: true },
  )

  const planLabel = computed(() => {
    const plan = store.profile?.subscription_plan ?? 'free'
    if (plan === 'business') return 'Визитка бизнеса'
    if (plan === 'pro') return 'Pro'
    return 'Бесплатный'
  })

  /**
   * Подпись формы собственности по коду.
   * @param form код legal_form
   */
  function legalFormLabel(form: string | null | undefined): string {
    if (!form) return '—'
    return LEGAL_FORM_LABELS[form] ?? form
  }

  async function load(): Promise<void> {
    if (!store.dashboard && !store.loading) {
      await store.loadAll()
    }
  }

  /**
   * Загрузить логотип компании.
   * @param file картинка
   * @returns true если сохранён
   */
  async function uploadLogoFile(file: File): Promise<boolean> {
    const ok = await store.uploadLogo(file)
    if (ok) {
      toast.add({ severity: 'success', summary: 'Логотип обновлён', detail: 'Клиенты видят его на карте и в профиле', life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: 'Не загрузилось', detail: store.error ?? 'Попробуйте другой файл', life: 4000 })
    }
    return ok
  }

  /**
   * Сохранить бренд компании (витринное название).
   *
   * Шлём name + legal_form из профиля (PATCH их требует),
   * меняется только бренд — проверка не слетает. Бренд после
   * сохранения виден везде: кабинет, витрина, карта, поиск.
   *
   * @returns true если сохранён
   */
  async function saveBrand(): Promise<boolean> {
    const current = store.profile
    if (!current) {
      return false
    }
    const brand = brandDraft.value.trim().slice(0, 255)
    if ((current.brand ?? '') === brand) {
      return true
    }
    const ok = await store.save({
      name: current.name,
      legal_form: current.legal_form,
      brand: brand === '' ? null : brand,
    })
    if (ok) {
      brandTouched.value = false
      brandDraft.value = store.profile?.brand ?? ''
      toast.add({ severity: 'success', summary: 'Бренд обновлён', detail: 'Название видно клиентам везде', life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: 'Не сохранилось', detail: store.error ?? 'Попробуйте позже', life: 4000 })
    }
    return ok
  }

  /**
   * Загрузить баннер-обложку компании.
   * @param file картинка (уже обрезанная под 3:1 или маленькая)
   * @returns true если сохранена
   */
  async function uploadCoverFile(file: File): Promise<boolean> {
    const ok = await store.uploadCover(file)
    if (ok) {
      toast.add({ severity: 'success', summary: 'Обложка обновлена', detail: 'Фон плашки кабинета и профиля', life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: 'Не загрузилось', detail: store.error ?? 'Попробуйте другой файл', life: 4000 })
    }
    return ok
  }

  /**
   * Выбрать файл обложки: большая картинка уходит в кроп 3:1,
   * маленькая (обе стороны ≤800 и вес ≤400КБ) грузится сразу.
   * @param file исходный файл из input
   */
  async function pickCoverFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      toast.add({ severity: 'warn', summary: 'Нужна картинка', life: 2500 })
      return
    }
    if (file.size > MAX_PHOTO_INPUT_BYTES) {
      toast.add({ severity: 'error', summary: 'Фото больше 10 МБ', life: 2500 })
      return
    }
    try {
      const size = await readImageSize(file)
      if (size.w <= 800 && size.h <= 800) {
        await uploadCoverFile(file)
        return
      }
    } catch {
      // Не прочитали размер — безопасно уходим в кроп.
    }
    await coverCrop.openWithFile(file)
  }

  /**
   * Подтвердить кроп обложки: режем баннер 1500×500 и грузим.
   */
  async function confirmCoverCrop(): Promise<void> {
    if (coverCrop.confirming.value) return
    coverCrop.confirming.value = true
    try {
      const banner = await coverCrop.exportCropped()
      if (!banner) {
        toast.add({ severity: 'error', summary: 'Не вышло обрезать обложку', life: 2500 })
        return
      }
      coverCrop.close()
      await uploadCoverFile(banner)
    } finally {
      coverCrop.confirming.value = false
    }
  }

  /**
   * Отменить кроп обложки.
   */
  function cancelCoverCrop(): void {
    coverCrop.reset()
  }

  /**
   * Натуральный размер картинки из файла.
   * @param file файл картинки
   */
  function readImageSize(file: File): Promise<{ w: number; h: number }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const size = { w: img.naturalWidth, h: img.naturalHeight }
        URL.revokeObjectURL(url)
        resolve(size)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('decode'))
      }
      img.src = url
    })
  }

  onMounted(() => {
    void load()
  })

  return {
    store,
    profile,
    isVerified,
    planLabel,
    legalFormLabel,
    isDark: theme.isDark,
    toggleTheme: theme.toggle,
    push,
    pwa,
    guide,
    load,
    uploadLogoFile,
    uploadCoverFile,
    brandDraft,
    brandTouched,
    saveBrand,
    coverCrop,
    pickCoverFile,
    confirmCoverCrop,
    cancelCoverCrop,
  }
}
