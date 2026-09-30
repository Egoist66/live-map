import { computed } from 'vue'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { route } from '@/route'
import { useProfileShowPage } from '@/composables/useProfileShowPage'
import { useProfileGallery } from '@/composables/useProfileGallery'
import { useProfilePeople } from '@/composables/useProfilePeople'
import { usePeopleSearch } from '@/composables/usePeopleSearch'
import { useProfilePhotoComments } from '@/composables/useProfilePhotoComments'
import { useAvatarPreview } from '@/composables/useAvatarPreview'
import { useSwipesCta } from '@/composables/useSwipesCta'
import { useDistrictsCta } from '@/composables/useDistrictsCta'
import { usePhotoPicker } from '@/composables/usePhotoPicker'
import { planOf } from '@/composables/usePlanLimits'
import { useProfileInfoTiles } from '@/composables/useProfileInfoTiles'

/**
 * Состояние и действия страницы профиля в дизайне design.jpg.
 *
 * Агрегирует страницу, галерею, друзей, поиск и свайпы в один хук,
 * чтобы компонент Show.vue отвечал только за отображение.
 *
 * @param props пропсы страницы (profileUser, isOwn, дружба, подписка)
 * @returns производные данные для тёмных карточек и обработчики
 * @example
 * const design = useProfileDesign(props)
 * await design.init()
 */
export function useProfileDesign(props: {
  profileUser: any
  isOwn: boolean
  friendship: any
  isFriend: boolean
  isPending: boolean
  isBlocked?: boolean
  isBlockedBy?: boolean
  canMessage: boolean
  canMessageReason: string | null
  subscription?: { subscribed: boolean; notify_pin: boolean; notify_photo: boolean; notify_level: boolean; notify_post?: boolean }
}) {
  const page = useProfileShowPage(props)
  const gallery = useProfileGallery(() => props.profileUser.id, { isOwn: props.isOwn })
  const people = useProfilePeople()
  const search = usePeopleSearch()
  const { goSwipes } = useSwipesCta()
  const { goDistricts } = useDistrictsCta()

  const photoComments = useProfilePhotoComments(
    () => gallery.active.value?.id ?? null,
    (next: number) => {
      const current = gallery.active.value
      if (current) gallery.syncCounts(current.id, { comments_count: next })
    },
  )

  useAvatarPreview(() => page.showAvatar.value, () => (page.showAvatar.value = false))

  const { pickerInput, openPicker, handlePickerChange } = usePhotoPicker({
    onPick: (file: File) => onAddPhoto(file),
  })

  const infoTiles = useProfileInfoTiles(() => props.profileUser)
  const levelName = computed(
    () => (page.levelLabel as any)[props.profileUser.level] || props.profileUser.level || 'Новичок',
  )
  const planName = computed(() => {
    const plan = planOf(props.profileUser)
    if (plan === 'business') return 'Business'
    if (plan === 'premium') return 'Premium'
    if (plan === 'pro') return 'Pro'
    return 'Free'
  })
  const reputationText = computed(() => `${props.profileUser.reputation_score || 0}`)
  const emailText = computed(() => props.profileUser.email || '')

  /**
   * Почта подтверждена по ссылке из письма.
   *
   * @returns true когда email_verified_at заполнен
   */
  const emailVerified = computed(() => !!props.profileUser.email_verified_at)
  const bioQuote = computed(() => page.bioText.value)

  /** Короткое превью «О себе» для плитки общей информации. */
  const bioPreview = computed(() => {
    const text = page.bioText.value
    if (text.length <= 80) return text
    return `${text.slice(0, 80).trimEnd()}…`
  })
  const galleryPreview = computed(() => gallery.photos.value.slice(0, 8))
  const statusText = computed(() => (page.online.value ? 'онлайн' : 'оффлайн'))
  const presenceText = computed(() => (page.online.value ? 'в сети' : page.lastSeenText.value))

  /** Строка под именем: только мысль пользователя, «О себе» — отдельное поле. */
  const headlineText = computed(() => {
    return (props.profileUser.thought || '').trim()
  })

  /** Одна пустая ячейка с крестиком для добавления фото (только свои, пока есть лимит). */
  const addSlots = computed(() => {
    if (!props.isOwn || page.isLocked.value) return 0
    if (!gallery.canAdd.value) return 0
    return gallery.remaining.value > 0 ? 1 : 0
  })

  /**
   * Первичная загрузка данных страницы: галерея и счётчик друзей.
   */
  async function init(): Promise<void> {
    await gallery.load()
    try {
      await gallery.consumePendingPhoto()
    } catch {}
    try {
      await people.loadFriendsCount(props.profileUser.id)
    } catch {}
  }

  /**
   * Загружает выбранное фото в галерею.
   * @param file файл изображения
   */
  async function onAddPhoto(file: File): Promise<void> {
    await gallery.upload(file)
  }

  /**
   * Делает фото главным: аватар профиля указывает на файл фото,
   * затем подтягивает свежие avatar_url (профиль + топбар).
   * @param photo фото из своей галереи
   */
  async function setMainAvatar(photo: { id: number }): Promise<void> {
    const toast = (() => { try { return useToast() } catch { return null } })()
    try {
      await gallery.setMain(photo as any)
      toast?.add({ severity: 'success', summary: 'Главное фото обновлено', life: 2000 })
      router.reload({ only: ['profileUser', 'auth'] })
    } catch {
      toast?.add({ severity: 'error', summary: 'Не удалось сделать фото главным', life: 2500 })
    }
  }

  /** Открывает карту. */
  function onOpenMap(): void {
    router.visit('/map')
  }

  /** Открывает редактирование профиля. */
  function onEdit(): void {
    router.visit(route('profile.edit'))
  }

  /** Плавно прокручивает страницу наверх. */
  function scrollTop(): void {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {}
  }

  return {
    page,
    gallery,
    people,
    search,
    photoComments,
    pickerInput,
    levelName,
    planName,
    reputationText,
    emailText,
    emailVerified,
    bioQuote,
    bioPreview,
    headlineText,
    galleryPreview,
    statusText,
    presenceText,
    addSlots,
    infoTiles,
    subscription: props.subscription,
    init,
    onAddPhoto,
    setMainAvatar,
    openPicker,
    handlePickerChange,
    onOpenMap,
    onEdit,
    scrollTop,
    goSwipes,
    goDistricts,
  }
}
