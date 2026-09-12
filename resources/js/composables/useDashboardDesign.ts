import { computed } from 'vue'
import { useDashboardPage } from '@/composables/useDashboardPage'
import { useProfileGallery } from '@/composables/useProfileGallery'
import { useProfilePeople } from '@/composables/useProfilePeople'
import { usePeopleSearch } from '@/composables/usePeopleSearch'
import { useProfilePhotoComments } from '@/composables/useProfilePhotoComments'
import { useSwipesCta } from '@/composables/useSwipesCta'
import { usePhotoPicker } from '@/composables/usePhotoPicker'
import { planOf } from '@/composables/usePlanLimits'
import { useProfileInfoTiles } from '@/composables/useProfileInfoTiles'

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', business: 'Business' }

/**
 * Состояние и действия своего профиля (Dashboard) в дизайне design.jpg.
 *
 * Держит всю логику вне компонента: страница показывает только тёмные
 * карточки через ProfileDesign*.vue.
 *
 * @param propsUser пользователь из пропсов страницы или auth
 * @param propsIsOwn флаг владения профилем
 * @returns данные для карточек, диалоги и обработчики
 * @example
 * const design = useDashboardDesign(props.user, props.isOwn)
 * await design.init()
 */
export function useDashboardDesign(propsUser?: any, propsIsOwn?: boolean) {
  const dash = useDashboardPage(propsUser, propsIsOwn)
  const gallery = useProfileGallery(() => dash.u.value.id, { isOwn: true })
  const people = useProfilePeople()
  const search = usePeopleSearch()
  const { goSwipes } = useSwipesCta()

  const photoComments = useProfilePhotoComments(
    () => gallery.active.value?.id ?? null,
    (next: number) => {
      const current = gallery.active.value
      if (current) gallery.syncCounts(current.id, { comments_count: next })
    },
  )

  const { pickerInput, openPicker, handlePickerChange } = usePhotoPicker({
    onPick: (file: File) => onAddPhoto(file),
  })

  const planName = computed(() => PLAN_LABEL[planOf(dash.u.value)] || 'Free')
  const infoTiles = useProfileInfoTiles(dash.u)
  const reputationText = computed(() => `${dash.u.value.reputation_score || 0}`)
  const emailText = computed(() => dash.u.value.email || '')
  const galleryPreview = computed(() => gallery.photos.value.slice(0, 8))
  const statusText = computed(() => (dash.presence.value.active ? 'онлайн' : 'оффлайн'))
  const presenceText = computed(() => (dash.presence.value.active ? 'в сети' : dash.presence.value.label))

  /** Короткое превью «О себе» для плитки общей информации. */
  const bioPreview = computed(() => {
    const text = dash.bioText.value
    if (text.length <= 80) return text
    return `${text.slice(0, 80).trimEnd()}…`
  })

  /** Строка под именем: мысль пользователя или текст «О себе». */
  const headlineText = computed(() => {
    const thought = (dash.u.value.thought || '').trim()
    if (thought) return thought
    return dash.bioText.value
  })

  /** Одна пустая ячейка с крестиком для добавления фото (пока есть лимит). */
  const addSlots = computed(() => {
    if (!gallery.canAdd.value) return 0
    return gallery.remaining.value > 0 ? 1 : 0
  })

  /**
   * Первичная загрузка данных страницы: галерея и счётчик друзей.
   */
  async function init(): Promise<void> {
    await gallery.load()
    try {
      await people.loadFriendsCount(dash.u.value.id)
    } catch {}
  }

  /**
   * Загружает выбранное фото в галерею.
   * @param file файл изображения
   */
  async function onAddPhoto(file: File): Promise<void> {
    await gallery.upload(file)
  }

  return {
    dash,
    gallery,
    people,
    search,
    photoComments,
    pickerInput,
    planName,
    reputationText,
    emailText,
    galleryPreview,
    statusText,
    presenceText,
    headlineText,
    bioPreview,
    addSlots,
    infoTiles,
    init,
    onAddPhoto,
    openPicker,
    handlePickerChange,
    goSwipes,
  }
}
