import { ref, computed, watch, nextTick } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { replaceUrlPreservingState } from '@/composables/useHistoryState'
import { usePins } from '@/composables/usePins'
import { useMap } from '@/composables/useMap'
import { usePinDetails } from '@/composables/usePinDetails'
import { useGeolocation } from '@/composables/useGeolocation'
import { useTheme } from '@/composables/useTheme'
import { useReverseGeocode } from '@/composables/useReverseGeocode'
import { usePinCreate } from '@/composables/usePinCreate'
import { usePinEdit } from '@/composables/usePinEdit'
import { useToast } from 'primevue/usetoast'
import { useMapOverlays } from '@/composables/useMapOverlays'
import { useDistricts } from '@/composables/useDistricts'
import { useDistrictPaint } from '@/composables/useDistrictPaint'
import { useDistrictInvite } from '@/composables/useDistrictInvite'
import { countGeometryPoints } from '@/utils/districtGeo'
import { saveDistrictDraft } from '@/composables/useDistrictDraft'
import { useAppConfirm } from '@/composables/useAppConfirm'
import { useCustomCategories } from '@/composables/useCustomCategories'
import { useHomeZoneVisibility } from '@/composables/useHomeZoneVisibility'
import { planOf, maxHomeRadiusKm } from '@/composables/usePlanLimits'
import { useAppModulesStore } from '@/stores/appModules'
import { resolveInitialCenter, homeAnchorOf, isSaneFix } from '@/composables/useMapInitialCenter'
import { haversineKm } from '@/utils/geo'
import { useHomeZoneGuard } from '@/composables/useHomeZoneGuard'

export function useMapPage() {
  const { store, selectedCategory, filteredPins, fetchNearby } = usePins()
  const customCats = useCustomCategories()
  const categories = customCats.allCategories
  const pinDetails = usePinDetails()
  const { confirmDelete } = useAppConfirm()
  const { requestGeolocation } = useGeolocation()
  const { isDark } = useTheme()

  const showCreate = ref(false)
  const pinAddress = ref('')
  const loadingPinAddress = ref(false)
  const { address: myStreet, loading: loadingStreet, fetch: fetchStreet } = useReverseGeocode() as any

  const pinEdit = usePinEdit()
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const pinCreate = usePinCreate(() => {
    mapApi.removeTempMarker()
    mapApi.renderPins()
    showCreate.value = false
  })

  const mapApi = useMap(pinDetails.openPin, (p: any) => {
    pinDetails.openPin(p)
    nextTick(() => pinEdit.start(p))
  })

  /**
   * Бизнес-маркеры: только при включённом модуле бизнеса.
   *
   * useBusinessMarkers — map-слой (maplibre, fetch по moveend) живёт
   * в ленивом чанке: статический импорт тянул бы весь бизнес-код на
   * карту даже upin-only пользователям. Состояние модалки компании
   * при этом хранится в stores/businessMarkers (главный чанк).
   */
  let bizMarkers: { attach: (map: unknown, hooks: unknown) => void; detach: () => void } | null = null

  /**
   * Подключить слой компаний: особые метки + модалка пинов.
   *
   * Клик по пину компании из модалки — долететь и открыть карточку.
   * Без модуля бизнеса — no-op, чанк mod-business не грузится.
   */
  async function wireBusinesses(): Promise<void> {
    let enabled = false

    try {
      enabled = useAppModulesStore().isEnabled('business')
    } catch {
      enabled = false
    }

    if (!enabled) {
      return
    }

    try {
      const { useBusinessMarkers } = await import('@/composables/useBusinessMarkers')
      bizMarkers = useBusinessMarkers() as unknown as typeof bizMarkers
    } catch {
      return
    }

    try {
      bizMarkers?.attach(mapApi as any, {
        openPin: (pin: any) => {
          try {
            pinDetails.openPinById(Number(pin.id))
          } catch {}
        },
      })
    } catch {}
  }

  const overlays = useMapOverlays(
    (lat, lng) => mapApi.map?.flyTo({ center: [lng, lat] as any, zoom: 15, duration: 900 }),
    (p) => pinDetails.openPin(p),
  )

  const districts = useDistricts()
  const paint = useDistrictPaint()
  const districtInvite = useDistrictInvite()
  const pendingGeometry = ref<any | null>(null)
  const createError = ref<string | null>(null)
  let lastDistrictsFetch = 0
  let districtsInflight = false
  let districtsBlockedUntil = 0
  let lastDistrictsBbox: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null = null

  /**
   * Визуальная ширина кисти в пикселях SVG-оверлея.
   */
  const brushPx = computed(() => {
    const radius = Number(paint.brushRadiusM.value)
    if (radius <= 150) return 14
    if (radius <= 280) return 22
    return 34
  })

  const districtLimitText = computed(() => {
    const plan = userPlan.value
    const isAdmin = !!((page.props.auth?.user as any)?.is_admin || (page.props.auth?.user as any)?.role === 'admin')
    if (isAdmin) return 'Своих районов — безлимит'
    if (plan === 'business') return 'Business: до 15 своих районов'
    if (plan === 'premium') return 'Premium: до 15 своих районов'
    if (plan === 'pro') return 'Pro: до 5 своих районов'
    return 'Free: 2 своих района бесплатно'
  })

  /**
   * Подтянуть UDistrict-заливки в видимом прямоугольнике.
   *
   * Троттлинг 3с + пропуск микродвижений bbox: панорамирование карты
   * иначе засыпает /api/districts и упирается в 429 вместе с пинами
   * и тиком realtime/sync. Параллельные вызовы схлопываются флагом,
   * после 429 держим паузу 15с.
   *
   * Первый fetch после открытия карты идёт по стартовому центру,
   * живой GPS прилетает позже и двигает карту — без форса второй
   * fetch режется троттлингом и район появляется только после
   * следующего движения карты (задержка/рассинхрон).
   *
   * @param force игнорировать троттлинг (включение слоя, GPS-фикс, повтор)
   */
  async function fetchDistrictsForView(force = false): Promise<void> {
    const now = Date.now()
    if (!force && now < districtsBlockedUntil) {
      return
    }
    if (!force && now - lastDistrictsFetch < 3000) {
      return
    }
    if (districtsInflight) {
      return
    }
    let bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null = null
    try {
      const bounds = (mapApi as any).map?.getBounds?.()
      if (!bounds) {
        return
      }
      bbox = {
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
      }
    } catch {
      return
    }
    if (!force && lastDistrictsBbox && isSameBbox(lastDistrictsBbox, bbox)) {
      return
    }
    districtsInflight = true
    lastDistrictsFetch = now
    try {
      await districts.store.fetchInBbox(bbox)
      lastDistrictsBbox = bbox
    } catch (e: any) {
      if (Number(e?.response?.status) === 429) {
        districtsBlockedUntil = Date.now() + 15000
      }
    } finally {
      districtsInflight = false
    }
  }

  /**
   * bbox почти не сдвинулся — новый запрос не нужен.
   *
   * @param prev прошлый прямоугольник
   * @param next новый прямоугольник
   * @returns true если сдвиг меньше эпсилон
   */
  function isSameBbox(
    prev: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    next: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  ): boolean {
    const eps = 0.002
    const dLat = Math.abs(prev.minLat - next.minLat) + Math.abs(prev.maxLat - next.maxLat)
    const dLng = Math.abs(prev.minLng - next.minLng) + Math.abs(prev.maxLng - next.maxLng)
    return dLat < eps && dLng < eps
  }

  /**
   * Начать рисование района кистью с панели инструментов карты.
   *
   * Кнопка-палитра возле рефреша сразу вооружает кисть: на десктопе
   * мазок идёт с зажатым Alt + левая кнопка мыши. На мобилке
   * рисование недоступно — показываем предупреждение и ничего не открываем.
   */
  function startDistrictPaint(): void {
    const canDraw = districts.canCreate?.value ?? true
    if (!canDraw) {
      toast?.add({ severity: 'warn', summary: 'Недоступно на телефоне', detail: 'Нарисовать район можно только с компьютера: зажми Alt и веди мышью', life: 3500 })
      return
    }
    if (paint.painting.value) {
      return
    }
    districts.hubOpen.value = false
    pinDetails.closePin()
    districts.closeDistrict()
    createError.value = null
    paint.startPainting()
    toast?.add({ severity: 'info', summary: 'Чертёж UDistrict', detail: 'Зажми Alt и веди мышью с левой кнопкой — обведи круг, внутри всё зальётся', life: 4000 })
  }

  /**
   * Завершить мазки и уйти на страницу создания.
   *
   * Модалка убрана: черновик едет в sessionStorage, форма —
   * на /districts/create в стиле группы.
   */
  async function finishDistrictPaint(): Promise<void> {
    const geometry = await paint.takeDraftAsync()
    if (!geometry) {
      toast?.add({ severity: 'warn', summary: 'Пустая заливка', detail: 'Сначала закрась кусочек карты чертежом', life: 3000 })
      return
    }
    if (countGeometryPoints(geometry) > 600) {
      toast?.add({ severity: 'warn', summary: 'Слишком большая заливка', detail: 'Рисуй компактный островок — меньше мазков', life: 3500 })
      return
    }
    const strokesCount = paint.strokesCount.value
    pendingGeometry.value = geometry
    createError.value = null
    saveDistrictDraft(geometry, strokesCount)
    paint.clearStrokes()
    router.visit('/districts/create')
  }

  /**
   * Сохранить район из черновика кисти (старая модалка).
   *
   * Оставлен для совместимости: успех уводит на страницу сообщества.
   *
   * @param payload поля формы
   */
  async function saveDistrict(payload: { name: string; description: string | null; interest: string }): Promise<void> {
    if (!pendingGeometry.value) return
    createError.value = null
    try {
      const created: any = await districts.store.createDistrict({
        ...payload,
        geometry: pendingGeometry.value,
        user_lat: myPos.value?.lat ?? null,
        user_lng: myPos.value?.lng ?? null,
      })
      pendingGeometry.value = null
      districts.createOpen.value = false
      districts.setVisible(true)
      try { mapApi.setDistrictsVisible(true) } catch {}
      mapApi.renderDistricts(districts.store.districts as any)
      toast?.add({ severity: 'success', summary: 'Район создан', detail: 'Открываем страницу сообщества', life: 3000 })
      try { await districts.loadMine() } catch {}
      router.visit(`/districts/${created.id}`)
    } catch (e: any) {
      const message = e?.response?.data?.message ?? 'Не удалось создать район'
      createError.value = message
      toast?.add({ severity: 'error', summary: 'Не сохранено', detail: message, life: 5000 })
    }
  }

  /**
   * Догрузка заливок по движению карты (с троттлингом внутри).
   *
   * Во время рисования кистью карту не дёргаем запросами: мазки и так
   * перерисовывают превью на каждый кадр, лишний fetch даёт 429 и рвёт штрих.
   */
  function onDistrictsMoveEnd(): void {
    if (paint.painting.value) {
      return
    }
    if (typeof document !== 'undefined' && document.hidden) {
      return
    }
    void fetchDistrictsForView()
  }

  /**
   * Открыть район на странице сообщества с перелётом карты.
   *
   * Модалка деталей больше не используется: отдельный роут
   * /districts/{id} в стиле группы.
   *
   * @param id id района
   */
  async function flyToDistrict(id: number): Promise<void> {
    districts.hubOpen.value = false
    router.visit(`/districts/${id}`)
  }

  /**
   * Открыть общий чат района.
   */
  function openDistrictChat(conversationId: number): void {
    if (!(conversationId > 0)) return
    districts.closeDistrict()
    try {
      router.visit(`/chat/${conversationId}`)
    } catch {
      window.location.href = `/chat/${conversationId}`
    }
  }

  /**
   * Открыть пин из модалки района (модалка уступает место пину).
   *
   * @param pin пин из списка района
   */
  function openPinFromDistrict(pin: any): void {
    districts.closeDistrict()
    pinDetails.openPin(pin)
  }

  /**
   * Сохранить правки района с живой позицией для проверки зоны.
   *
   * @param payload поля формы
   */
  async function saveSelectedDistrict(payload: { name: string; description: string | null; interest: string }): Promise<boolean> {
    return districts.saveSelected({
      ...payload,
      user_lat: myPos.value?.lat ?? null,
      user_lng: myPos.value?.lng ?? null,
    })
  }

  /**
   * Открыть приглашение в выбранный район (владелец).
   */
  function openDistrictInvite(): void {
    const selected = districts.selected.value
    if (!selected) {
      return
    }
    districtInvite.show(Number(selected.id), String(selected.name ?? ''))
  }

  /**
   * Пригласить человека в выбранный район.
   *
   * @param userId кого зовём
   */
  async function sendDistrictInvite(userId: number): Promise<void> {
    const ok = await districtInvite.invite(userId)
    if (!ok) {
      return
    }
    toast?.add({ severity: 'success', summary: 'Приглашение отправлено', detail: 'Человек сам решит: примет или отклонит в уведомлениях', life: 3500 })
    try {
      await districts.refreshSelected()
    } catch {}
  }

  /**
   * Удалить выбранный район после подтверждения.
   */
  async function deleteDistrict(): Promise<void> {
    if (!districts.selected.value) return
    await deleteDistrictById(Number(districts.selected.value.id))
  }

  /**
   * Удалить район по id (правая кнопка мыши, хаб, карточка).
   *
   * @param id id района
   */
  async function deleteDistrictById(id: number): Promise<void> {
    if (!(id > 0)) return
    const known: any =
      districts.store.districts.find((d: any) => Number(d.id) === id) ??
      districts.myDistricts.value.find((d: any) => Number(d.id) === id) ??
      (Number(districts.selected.value?.id) === id ? districts.selected.value : null)
    const ok = await confirmDelete(`Район «${known?.name ?? 'без названия'}» исчезнет с карты вместе с общим чатом.`)
    if (!ok) return
    try {
      const { districtsApi } = await import('@/services/districts.api')
      await districtsApi.remove(id)
      districts.store.removeRealtime(id)
      if (Number(districts.selected.value?.id) === id) districts.closeDistrict()
      mapApi.renderDistricts(districts.store.districts as any)
      toast?.add({ severity: 'success', summary: 'Район удалён', life: 2500 })
      try { await districts.loadMine() } catch {}
    } catch (e: any) {
      toast?.add({ severity: 'error', summary: 'Не удалось удалить', detail: e?.response?.data?.message, life: 3500 })
    }
  }

  watch(isDark, (v) => mapApi.setThemeStyle(v))

  const page: any = usePage()
  const userPlan = computed(() => planOf(page.props.auth?.user))
  const { visible: homeZoneVisible, toggle: toggleHomeZone, set: setHomeZoneVisible } = useHomeZoneVisibility()
  const myPos = ref<{ lat: number; lng: number } | null>(null)
  const geoNotice = ref<{ place: string } | null>(null)
  /**
   * Живой гео-фикс получен (GPS/GeolocateControl).
   * Зону и точку рисуем только после него: иначе зона сначала
   * встаёт по якорю из профиля/кэша в стороне, а потом прыгает
   * к реальной точке — визуально как баг.
   */
  const hasLiveFix = ref(false)
  let flewToLive = false
  let unsubGeolocate: (() => void) | null = null
  let lastStreetPos: { lat: number; lng: number; at: number } | null = null

  /**
   * Троттлинг подписи "Вы здесь": GPS на мобилке дёргается каждую секунду.
   * @param lat широта нового фикса
   * @param lng долгота нового фикса
   * @returns true если сдвиг/пауза достаточны для нового reverse-geocode
   */
  function isStreetStale(lat: number, lng: number): boolean {
    if (!lastStreetPos) {
      return true
    }
    const distKm = haversineKm(lastStreetPos.lat, lastStreetPos.lng, lat, lng)
    const elapsedMs = Date.now() - lastStreetPos.at
    const movedFar = distKm > 0.03
    const movedBitAndIdle = distKm > 0.01 && elapsedMs > 60000
    return movedFar || movedBitAndIdle
  }

  /**
   * Запрашивает улицу только при значимом сдвиге, иначе оставляет кэш.
   * @param lat широта
   * @param lng долгота
   */
  function maybeFetchStreet(lat: number, lng: number): void {
    const stale = isStreetStale(lat, lng)
    if (!stale) {
      return
    }
    lastStreetPos = { lat, lng, at: Date.now() }
    void fetchStreet(lat, lng)
  }

  /**
   * Сохраняет последнюю хорошую позицию для следующего открытия карты.
   * @param lat широта
   * @param lng долгота
   */
  function saveLastPos(lat: number, lng: number): void {
    try { localStorage.setItem('live-map:last-pos', JSON.stringify({ lat, lng })) } catch {}
  }

  /**
   * Подпись места из профиля для баннера фолбэка.
   * @param user текущий пользователь из Inertia-props
   * @returns строка вида "Минск, Беларусь" или запасной текст
   */
  function residenceLabelOf(user: any): string {
    const city = String(user?.home_city || '').trim()
    const country = String(user?.country || '').trim()
    const parts = [city, country].filter(Boolean)
    return parts.length ? parts.join(', ') : 'вашего профиля'
  }

  /**
   * Скрывает баннер фолбэка на текущую сессию.
   */
  function dismissGeoNotice(): void {
    geoNotice.value = null
  }

  /**
   * Вручную запрашивает геопозицию через кнопку контрола карты.
   */
  function locateMe(): void {
    try { mapApi.triggerGeolocate?.() } catch {}
  }
  const homeRadiusKm = computed(() => {
    const user = page.props.auth?.user as any
    const isAdmin = !!(user?.is_admin || user?.role === 'admin')
    const wanted = Number(user?.home_radius_km ?? 10) || 10
    return Math.min(Math.max(1, wanted), maxHomeRadiusKm(userPlan.value, isAdmin))
  })
  const homeZone = computed(() => {
    if (!myPos.value || !hasLiveFix.value) return null
    return { lat: myPos.value.lat, lng: myPos.value.lng, radiusKm: homeRadiusKm.value }
  })
  function applyHomeZone() {
    const z = homeZone.value
    if (!z || !homeZoneVisible.value) {
      try { (mapApi as any).hideHomeZone?.() } catch {}
      return
    }
    try { (mapApi as any).showHomeZone?.(z.lat, z.lng, z.radiusKm) } catch {}
  }
  const radiusOptions = computed(() => {
    const plan = userPlan.value
    const isAdmin = !!(page.props.auth?.user?.is_admin || page.props.auth?.user?.role === 'admin')
    const isPro = isAdmin || plan === 'pro' || plan === 'premium' || plan === 'business'
    const isBiz = isAdmin || plan === 'premium' || plan === 'business'
    return [
      { v: 500, l: '500 м' },
      { v: 1000, l: '1 км' },
      { v: 2000, l: '2 км' },
      { v: 5000, l: '5 км' },
      { v: 10000, l: '10 км' },
      { v: 15000, l: '15 км', pro: true },
      { v: 20000, l: '20 км', biz: true },
      { v: 50000, l: '50 км', biz: true },
    ].map((o) => ({ ...o, disabled: ((o as any).pro && !isPro) || ((o as any).biz && !isBiz) }))
  })
  const radiusLabel = computed(() => {
    const v = Number((pinCreate.values as any)?.value?.radius_meters ?? 1000)
    return v >= 1000 ? `${v / 1000} км` : `${v} м`
  })

  const deleteMutation = {
    mutateAsync: (id: number) => store.deletePin(id),
  } as any

  async function fetchPinAddress(lat: number, lng: number) {
    loadingPinAddress.value = true
    try {
      const { reverseGeocode } = await import('@/services/geo.api')
      pinAddress.value = await reverseGeocode(lat, lng)
    } catch {
      pinAddress.value = ''
    } finally {
      loadingPinAddress.value = false
    }
  }

  function openCreate(lngLat: any) {
    if (paint.painting.value) return
    if ((mapApi as any).shouldSuppressMapClick?.()) return
    const guard = useHomeZoneGuard()
    const zone = guard.check(Number(lngLat.lat), Number(lngLat.lng), myPos.value)
    if (!zone.ok) {
      toast?.add({ severity: 'warn', summary: 'Вне вашей зоны', detail: zone.message, life: 5000 })
      return
    }
    pinCreate.setCoords(lngLat.lat, lngLat.lng)
    try { pinCreate.setDistrict(null) } catch {}
    fetchPinAddress(lngLat.lat, lngLat.lng)
    mapApi.addTempMarker(lngLat)
    try { void pinCreate.refreshLimit() } catch {}
    showCreate.value = true
  }

  /**
   * Открыть создание районного пина из меню района (правый клик).
   *
   * Точка — место клика внутри заливки, пин увидят только жители
   * района в своей зоне. Гость без членства не видит его до вступления.
   *
   * @param districtId район для привязки
   * @param lngLat точка клика внутри заливки (или null — центр района)
   */
  function openDistrictPinCreate(districtId: number, lngLat?: { lat: number; lng: number } | null): void {
    if (!(districtId > 0)) return
    if (paint.painting.value) return
    const card: any = districts.store.districts.find((d: any) => Number(d.id) === Number(districtId)) ?? null
    const role = String(card?.role ?? '')
    if (role !== 'owner' && role !== 'member') {
      toast?.add({ severity: 'warn', summary: 'Только для жителей', detail: 'Пин района могут ставить только его жители', life: 3500 })
      return
    }
    const lat = lngLat && Number.isFinite(Number(lngLat.lat)) ? Number(lngLat.lat) : Number(card?.center_lat)
    const lng = lngLat && Number.isFinite(Number(lngLat.lng)) ? Number(lngLat.lng) : Number(card?.center_lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const guard = useHomeZoneGuard()
    const zone = guard.check(lat, lng, myPos.value)
    if (!zone.ok) {
      toast?.add({ severity: 'warn', summary: 'Вне вашей зоны', detail: zone.message, life: 5000 })
      return
    }
    pinCreate.setCoords(lat, lng)
    try { pinCreate.setDistrict(districtId) } catch {}
    fetchPinAddress(lat, lng)
    try { mapApi.addTempMarker({ lat, lng }) } catch {}
    try { void pinCreate.refreshLimit() } catch {}
    showCreate.value = true
  }

  function closeCreate() {
    showCreate.value = false
    try { pinCreate.setDistrict(null) } catch {}
    mapApi.removeTempMarker()
  }

  /**
   * Сеттер диалога создания для шаблонов (прямое присваивание затрёт ref).
   *
   * @param v открыт ли диалог
   */
  function setShowCreate(v: boolean): void {
    if (!v) {
      closeCreate()
      return
    }
    showCreate.value = true
  }

  watch(showCreate, (v) => {
    if (!v || pinAddress.value) return
    const lat = (pinCreate.values as any)?.value?.latitude
    const lng = (pinCreate.values as any)?.value?.longitude
    if (Number.isFinite(lat) && Number.isFinite(lng)) fetchPinAddress(lat, lng)
  })

  watch(homeZone, () => applyHomeZone())

  watch(homeZoneVisible, () => applyHomeZone())

  watch(
    () => districts.store.districts,
    (list) => {
      if (districts.districtsVisible.value) {
        try { mapApi.renderDistricts(list as any) } catch {}
      }
    },
    { deep: true },
  )

  watch(
    () => districts.districtsVisible.value,
    (visible) => {
      try { mapApi.setDistrictsVisible(visible) } catch {}
      if (visible) {
        try { mapApi.renderDistricts(districts.store.districts as any) } catch {}
        void fetchDistrictsForView(true)
      }
    },
  )

  watch(
    () => paint.draftGeometry.value,
    (geometry) => {
      try { mapApi.previewDraft(geometry) } catch {}
    },
  )

  async function deleteSelectedPin() {
    if (!pinDetails.selectedPin.value) return
    const ok = await confirmDelete(`Пин «${pinDetails.selectedPin.value.title}» будет удалён навсегда вместе с комментариями.`)
    if (!ok) return
    try {
      await (deleteMutation as any).mutateAsync(pinDetails.selectedPin.value.id)
      pinDetails.closePin()
      mapApi.renderPins()
      try { await pinCreate.refreshLimit() } catch {}
    } catch (e: any) {
      toast?.add({ severity: 'error', summary: 'Ошибка удаления', detail: e?.response?.data?.message, life: 3000 })
    }
  }

  watch(pinDetails.selectedPin, () => {
    pinEdit.cancel()
  })

  async function saveEdit() {
    const data: any = await pinEdit.save()
    if (data && pinDetails.selectedPin.value) Object.assign(pinDetails.selectedPin.value, data)
    mapApi.renderPins()
  }

  async function deleteCustomCategory(slug: string) {
    const ok = await confirmDelete(`Своя категория будет удалена. Пины с ней останутся, но без оформления.`, 'Удалить категорию?')
    if (!ok) return
    try {
      await customCats.remove(slug)
      if ((pinCreate.values.value as any)?.category === slug) pinCreate.setValues({ category: 'announcement' } as any)
      mapApi.renderPins()
      toast?.add({ severity: 'success', summary: 'Категория удалена', life: 2000 })
    } catch (e: any) {
      toast?.add({ severity: 'error', summary: 'Не удалось удалить категорию', detail: e?.response?.data?.message, life: 3000 })
    }
  }

  function openCreateFromUI() {
    const guard = useHomeZoneGuard()
    if (myPos.value) {
      const zone = guard.check(myPos.value.lat, myPos.value.lng, myPos.value)
      if (!zone.ok) {
        toast?.add({ severity: 'warn', summary: 'Вне вашей зоны', detail: zone.message, life: 5000 })
        return
      }
      pinCreate.setCoords(myPos.value.lat, myPos.value.lng)
    } else {
      const c: any = mapApi.getCenter?.()
      if (!c) return
      const zone = guard.check(Number(c.lat), Number(c.lng), null)
      if (!zone.ok) {
        toast?.add({ severity: 'warn', summary: 'Вне вашей зоны', detail: zone.message, life: 5000 })
        return
      }
      pinCreate.setCoords(c.lat, c.lng)
    }
    try { pinCreate.setDistrict(null) } catch {}
    try { void pinCreate.refreshLimit() } catch {}
    showCreate.value = true
  }

  function onEsc(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (districts.createOpen.value) { districts.createOpen.value = false; return }
    if (paint.painting.value) { paint.cancelPainting(); return }
    if (districts.detailsOpen.value) { districts.closeDistrict(); return }
    if (showCreate.value) { closeCreate(); return }
    if (pinEdit.editing.value) { pinEdit.cancel(); return }
    if (pinDetails.editingCommentId.value) { pinDetails.cancelEditComment(); return }
    if (pinDetails.selectedPin.value) { pinDetails.closePin(); return }
  }

  /**
   * Открыть создание пина по ?create=1 (горячая клавиша N вне карты).
   * Параметр чистится из URL, чтобы не мешать дальше.
   */
  function openCreateIfRequested(): void {
    let requested = false
    try {
      const url = new URL(window.location.href)
      requested = url.searchParams.get('create') === '1'
      if (requested) {
        url.searchParams.delete('create')
        replaceUrlPreservingState(url.toString())
      }
    } catch {
      requested = false
    }
    if (requested) openCreateFromUI()
  }

  async function init() {
    window.addEventListener('keydown', onEsc)
    window.addEventListener('map:open-create', openCreateFromUI)
    try { void customCats.fetchAll() } catch {}
    const user = page.props.auth?.user as any
    const anchor = homeAnchorOf(user)
    if (anchor) myPos.value = { ...anchor }
    const start = await resolveInitialCenter(user)
    const onMapClick = (e: any) => {
      const target = e.originalEvent?.target as HTMLElement
      if (target?.closest?.('.maplibregl-marker')) return
      openCreate(e.lngLat)
    }
    await nextTick()
    const isFallback = start.source === 'residence' || start.source === 'none'
    if (isFallback && !start.hasPrecise) geoNotice.value = { place: residenceLabelOf(user) }
    if (start.center) {
      if (!myPos.value && !isFallback) myPos.value = { ...start.center }
      try { await fetchNearby(start.center.lat, start.center.lng, undefined, myPos.value) } catch {}
      try {
        const mine = await store.fetchMine()
        mine.forEach((p: any) => { if (!store.pins.find((x: any) => x.id === p.id)) store.pins.unshift(p) })
        store.pruneExpired()
      } catch {}
      try {
        await store.fetchInvited()
      } catch {}
      const lngLat = [start.center.lng, start.center.lat] as any
      await mapApi.initMap(lngLat, onMapClick, start.zoom)
      mapApi.renderPins()
      try { (mapApi as any).hideHomeZone?.() } catch {}
      mapApi.bindRealtime()
      wireDistricts()
      void wireBusinesses()
    } else {
      await mapApi.initMap(null, onMapClick)
      mapApi.bindRealtime()
      try { await fetchNearby(0, 20) } catch {}
      void wireBusinesses()
    }
    let geo: { lat: number; lng: number; accuracy: number | null } | null = null
    try { geo = await requestGeolocation() } catch { geo = null }
    if (geo) {
      const sane = isSaneFix(geo.accuracy)
      hasLiveFix.value = true
      myPos.value = { lat: geo.lat, lng: geo.lng }
      if (sane) {
        saveLastPos(geo.lat, geo.lng)
        geoNotice.value = null
      }
      maybeFetchStreet(geo.lat, geo.lng)
      try { await fetchNearby(geo.lat, geo.lng, undefined, { lat: geo.lat, lng: geo.lng }) } catch {}
      try { await fetchDistrictsForView(true) } catch {}
      try { mapApi.renderDistricts(districts.store.districts as any) } catch {}
      mapApi.showUserLocation(geo.lat, geo.lng)
      applyHomeZone()
      if (sane && !flewToLive) {
        flewToLive = true
        try { mapApi.flyToMyLocation?.(geo.lat, geo.lng) } catch {}
      }
      mapApi.renderPins()
      setTimeout(() => applyHomeZone(), 1200)
    } else if (myPos.value) {
      hasLiveFix.value = true
      mapApi.showUserLocation(myPos.value.lat, myPos.value.lng)
      applyHomeZone()
    }
    unsubGeolocate = mapApi.onGeolocate?.((e: any) => {
      const raw = e?.coords ?? e
      const lat = Number(raw?.latitude)
      const lng = Number(raw?.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const rawAcc = Number(raw?.accuracy)
      const sane = isSaneFix(Number.isFinite(rawAcc) ? rawAcc : null)
      hasLiveFix.value = true
      myPos.value = { lat, lng }
      if (sane) {
        saveLastPos(lat, lng)
        geoNotice.value = null
      }
      maybeFetchStreet(lat, lng)
      mapApi.showUserLocation(lat, lng)
      applyHomeZone()
      try { void fetchDistrictsForView() } catch {}
      if (sane && !flewToLive) {
        flewToLive = true
        try { mapApi.flyToMyLocation?.(lat, lng) } catch {}
      }
    }) ?? null
    try { void consumePendingPin() } catch {}
    try { openCreateIfRequested() } catch {}
  }

  /**
   * Принять мазок с SVG-оверлея: экран в координаты, в черновик кисти.
   *
   * @param points точки мазка в пикселях оверлея
   */
  function onOverlayStrokeEnd(points: Array<{ x: number; y: number }>): void {
    const map = (mapApi as any).map
    if (!map?.unproject) {
      return
    }
    const lngLat: Array<{ lat: number; lng: number }> = []
    for (const point of points ?? []) {
      try {
        const ll = map.unproject([point.x, point.y])
        if (Number.isFinite(ll?.lat) && Number.isFinite(ll?.lng)) {
          lngLat.push({ lat: Number(ll.lat), lng: Number(ll.lng) })
        }
      } catch {}
    }
    paint.addStroke(lngLat)
  }

  /**
   * Подключить UDistrict-слой: клики по заливкам, догрузка по вьюпорту.
   *
   * Мазки ловит SVG-оверлей (DistrictPaintOverlay), маппинг
   * экрана в координаты — в onOverlayStrokeEnd выше.
   * Слушаем moveend и zoomend: зум без панорамы тоже меняет
   * набор районов, иначе слой отстаёт от вьюпорта.
   */
  function wireDistricts(): void {
    try { (mapApi as any).onDistrictClick?.((id: number) => { router.visit(`/districts/${id}`) }) } catch {}
    try {
      ;(mapApi as any).onDistrictMenu?.((action: 'open' | 'delete' | 'create-pin', id: number, lngLat?: { lat: number; lng: number } | null) => {
        if (action === 'delete') void deleteDistrictById(id)
        else if (action === 'create-pin') openDistrictPinCreate(id, lngLat ?? null)
        else router.visit(`/districts/${id}`)
      })
    } catch {}
    try { (mapApi as any).map?.on?.('moveend', onDistrictsMoveEnd) } catch {}
    try { (mapApi as any).map?.on?.('zoomend', onDistrictsMoveEnd) } catch {}
    if (districts.districtsVisible.value) {
      try { mapApi.renderDistricts(districts.store.districts as any) } catch {}
    } else {
      try { mapApi.setDistrictsVisible(false) } catch {}
    }
    void fetchDistrictsForView()
    void openDistrictIfRequested()
  }

  /**
   * Открыть район по ?district= (диплинк из уведомлений).
   *
   * Уводит на страницу сообщества.
   */
  async function openDistrictIfRequested(): Promise<void> {
    let districtId = 0
    try {
      const url = new URL(window.location.href)
      districtId = Number(url.searchParams.get('district') || 0)
      if (districtId > 0) {
        url.searchParams.delete('district')
        replaceUrlPreservingState(url.toString())
      }
    } catch {
      districtId = 0
    }
    if (!(districtId > 0)) return
    router.visit(`/districts/${districtId}`)
  }

  function readPendingPin(): { pinId: number; commentId: number | null } | null {
    try {
      const q = new URLSearchParams(window.location.search)
      const qp = Number(q.get('pin') || 0)
      if (qp) return { pinId: qp, commentId: Number(q.get('comment') || 0) || null }
    } catch {}
    try {
      const raw = sessionStorage.getItem('live-map:pending-activity')
      if (!raw) return null
      const p = JSON.parse(raw)
      if (p?.type === 'pin' && Number(p.pinId)) return { pinId: Number(p.pinId), commentId: Number(p.commentId) || null }
    } catch {}
    return null
  }

  function clearPendingPin() {
    try { sessionStorage.removeItem('live-map:pending-activity') } catch {}
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('pin') || url.searchParams.has('comment')) {
        url.searchParams.delete('pin')
        url.searchParams.delete('comment')
        replaceUrlPreservingState(url.toString())
      }
    } catch {}
  }

  async function consumePendingPin() {
    const target = readPendingPin()
    if (!target) return
    let pin: any = store.pins.find((x: any) => Number(x.id) === Number(target.pinId)) ?? null
    if (!pin) {
      try { pin = await pinDetails.openPinById(target.pinId, target.commentId) } catch { pin = null }
    } else {
      pinDetails.openPin(pin, target.commentId)
    }
    if (!pin && !pinDetails.selectedPin.value) return
    const opened: any = pinDetails.selectedPin.value ?? pin
    try {
      const lat = Number(opened?.latitude)
      const lng = Number(opened?.longitude)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        try { mapApi.map?.flyTo?.({ center: [lng, lat] as any, zoom: 15, duration: 900 }) } catch {}
      }
    } catch {}
    clearPendingPin()
    if (target.commentId) {
      setTimeout(() => {
        try { document.getElementById(`pin-comment-${target.commentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch {}
      }, 600)
    }
  }

  function destroy() {
    window.removeEventListener('keydown', onEsc)
    window.removeEventListener('map:open-create', openCreateFromUI)
    try { bizMarkers?.detach() } catch {}
    try { (mapApi as any).map?.off?.('moveend', onDistrictsMoveEnd) } catch {}
    try { (mapApi as any).map?.off?.('zoomend', onDistrictsMoveEnd) } catch {}
    try { unsubGeolocate?.() } catch {}
    unsubGeolocate = null
    try { (mapApi as any).unbindRealtime?.() } catch {}
    try { (mapApi as any).destroyMap?.() } catch {}
    try { void consumePendingPin() } catch {}
  }

  return {
    store, categories, customCats, selectedCategory, filteredPins, pinDetails, pinCreate, pinEdit, mapApi,
    showCreate, pinAddress, loadingPinAddress, myStreet, loadingStreet,
    radiusOptions, radiusLabel, homeZone, homeZoneVisible, toggleHomeZone, setHomeZoneVisible, openCreate, openDistrictPinCreate, openCreateFromUI, closeCreate, deleteSelectedPin, saveEdit, deleteCustomCategory, init, destroy,
    deleteMutation, geoNotice, dismissGeoNotice, locateMe, hasLiveFix,
    districts, paint, pendingGeometry, createError, districtLimitText, brushPx, districtInvite,
    startDistrictPaint, finishDistrictPaint, saveDistrict, saveSelectedDistrict, flyToDistrict, openDistrictChat, deleteDistrict,
    openDistrictInvite, sendDistrictInvite,
    openPinFromDistrict, onOverlayStrokeEnd, setShowCreate,
    ...overlays,
  }
}
