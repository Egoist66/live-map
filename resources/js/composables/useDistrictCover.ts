import { ref, type Ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { districtsApi } from '@/services/districts.api'
import { useDistrictsStore } from '@/stores/districts'
import { MAX_PHOTO_INPUT_BYTES } from '@/utils/image'
import { useImageCompress } from '@/composables/useImageCompress'
import type { DistrictDetails } from '@/types/entities/District'

/**
 * Общая обложка района: ставит только владелец, видят все.
 *
 * В отличие от фона чата (только для себя), обложка хранится
 * на районе и отдаётся всем в `cover_url`.
 *
 * @param district карточка района из useDistrictShowPage
 * @param isOwner true когда текущий юзер — создатель
 * @example
 * const cover = useDistrictCover(page.district, page.isOwner)
 * await cover.upload(file)
 */
export function useDistrictCover(
  district: Ref<DistrictDetails | null>,
  isOwner: Ref<boolean>,
) {
  const store = useDistrictsStore()
  const { compressImageFast } = useImageCompress()

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

  /** Идёт ли загрузка/удаление обложки. */
  const uploading = ref(false)
  /** Скрытый file-input для выбора картинки. */
  const fileInput = ref<HTMLInputElement | null>(null)

  /**
   * Привязать скрытый file-input из шаблона.
   *
   * @param element DOM-узел input
   */
  function setFileInput(element: unknown): void {
    if (element instanceof HTMLInputElement) {
      fileInput.value = element
    } else {
      fileInput.value = null
    }
  }

  /**
   * Открыть системный выбор картинки (только владелец).
   */
  function openPicker(): void {
    if (!isOwner.value || uploading.value) {
      return
    }

    fileInput.value?.click()
  }

  /**
   * Применить district из ответа API в ref + стор.
   *
   * @param updated свежая карточка с бэка
   */
  function applyUpdated(updated: DistrictDetails): void {
    district.value = updated
    store.upsertRealtime(updated)
  }

  /**
   * Загрузить новую обложку из file-input.
   *
   * @param event событие change скрытого input
   */
  async function onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const picked = input.files?.[0] ?? null
    input.value = ''

    if (!picked) {
      return
    }

    await upload(picked)
  }

  /**
   * Сжать и отправить картинку на бэк.
   *
   * @param file исходная картинка
   * @returns true когда обложка встала
   */
  async function upload(file: File): Promise<boolean> {
    if (!isOwner.value) {
      return false
    }

    const currentId = Number(district.value?.id)

    if (!(currentId > 0) || uploading.value) {
      return false
    }

    if (!file.type.startsWith('image/')) {
      toast?.add({ severity: 'warn', summary: 'Нужна картинка', life: 2500 })
      return false
    }

    if (file.size > MAX_PHOTO_INPUT_BYTES) {
      toast?.add({ severity: 'error', summary: 'Фото больше 10 МБ', life: 2500 })
      return false
    }

    uploading.value = true

    try {
      const small = await compressImageFast(file, 1920, 0.84)
      const updated = await districtsApi.uploadCover(currentId, small)
      applyUpdated(updated)
      toast?.add({ severity: 'success', summary: 'Обложка обновлена', detail: 'Её видят все жители и гости', life: 2500 })
      return true
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло загрузить обложку', life: 3000 })
      return false
    } finally {
      uploading.value = false
    }
  }

  /**
   * Убрать обложку (только владелец).
   */
  async function remove(): Promise<void> {
    if (!isOwner.value || uploading.value) {
      return
    }

    const currentId = Number(district.value?.id)

    if (!(currentId > 0)) {
      return
    }

    uploading.value = true

    try {
      const updated = await districtsApi.removeCover(currentId)
      applyUpdated(updated)
      toast?.add({ severity: 'success', summary: 'Обложка убрана', life: 2000 })
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло убрать обложку', life: 3000 })
    } finally {
      uploading.value = false
    }
  }

  return {
    fileInput,
    setFileInput,
    uploading,
    openPicker,
    onFile,
    upload,
    remove,
  }
}
