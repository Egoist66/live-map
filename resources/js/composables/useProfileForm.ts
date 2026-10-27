import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { updateProfileSchema } from '@/validation/schemas/profile.schema'
import { usePage, router } from '@inertiajs/vue3'
import { route } from '@/route'
import { useToast } from 'primevue/usetoast'
import { maxHomeRadiusKm } from './usePlanLimits'
import { useHomeLocation } from './useHomeLocation'
import { useUserAge } from './useUserAge'
import { RESIDENCE_COUNTRIES, normalizeCountryCode } from './useResidence'
import { planOf } from './usePlanLimits'
import { useCountryMismatch } from './useCountryMismatch'
import { useGeolocation } from './useGeolocation'
import { reverseGeocodeHome } from '@/services/geo.api'
import { isUnchangedPayload } from './useUnchangedGuard'

export function useProfileForm() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any).user)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  /**
   * Значения формы из пользователя: единый маппинг для старта,
   * фоновой синхронизации и сброса baseline после сохранения.
   *
   * @param u пользователь из пропсов
   */
  function mapUserToValues(u: any): Record<string, unknown> {
    return {
      name: u?.name,
      gender: u?.gender || null,
      birth_date: u?.birth_date ? String(u.birth_date).slice(0, 10) : null,
      country: u?.country || null,
      country_code: u?.country_code || null,
      email: u?.email,
      home_lat: u?.home_lat || null,
      home_lng: u?.home_lng || null,
      home_city: u?.home_city || null,
      home_address: u?.home_address || null,
      home_visibility: u?.home_visibility || 'everyone',
      home_show_exact: !!u?.home_show_exact,
      home_radius_km: u?.home_radius_km || 10,
      bio: u?.bio || null,
      is_anonymous_default: !!u?.is_anonymous_default,
      plan: planOf(u),
    }
  }

  const { defineField, handleSubmit, errors, values, setValues, setErrors, isSubmitting, meta, resetForm } = useForm({
    validationSchema: updateProfileSchema,
    initialValues: mapUserToValues(user.value) as any,
  })

  /**
   * Фоновая синхронизация формы со свежими пропсами.
   *
   * Не затираем несохранённые правки: пока форма dirty или идёт отправка
   * (загрузка аватара тоже обновляет auth через reload) — чужие обновления
   * ждут. Иначе набранный текст молча заменялся серверным.
   */
  watch(user, (u) => {
    if (isSubmitting.value) {
      return
    }

    if (meta.value.dirty) {
      return
    }

    setValues(mapUserToValues(u) as any)
  })

  const [name, nameAttrs] = defineField('name')
  const [gender] = defineField('gender')
  const [birth_date] = defineField('birth_date')
  const [country] = defineField('country')
  const [country_code] = defineField('country_code')
  const [email, emailAttrs] = defineField('email')
  const [home_lat, homeLatAttrs] = defineField('home_lat')
  const [home_lng, homeLngAttrs] = defineField('home_lng')
  const [home_city] = defineField('home_city')
  const [home_address] = defineField('home_address')
  const [home_visibility] = defineField('home_visibility')
  const [home_show_exact] = defineField('home_show_exact')
  const [home_radius_km] = defineField('home_radius_km')
  const [bio] = defineField('bio')
  const [is_anonymous_default] = defineField('is_anonymous_default')
  const [plan] = defineField('plan')

  const homeLocation = useHomeLocation({
    getPlan: () => String((values as any).plan || planOf(user.value)),
    isAdmin: () => !!user.value?.is_admin || user.value?.role === 'admin',
    getBlur: () => Number(user.value?.default_blur_meters ?? 300),
    setCoords: (lat, lng, address) => setValues({ home_lat: lat, home_lng: lng, home_address: address || (values as any).home_address } as any),
  })

  const geolocation = useGeolocation()

  /**
   * Подставить домашнюю точку по геолокации браузера.
   *
   * Берём точный адрес (zoom 18): город + улица, а если улицы в OSM
   * нет — район. Координаты нужны свайпам для дистанции, адрес —
   * чтобы человек видел, что точка попала в его двор, а не «в центр
   * города». Заодно обновляем город и страну из reverse-geocode: если
   * человек переехал, профиль не останется со старым городом.
   *
   * @param options silent — автоопределение: без тоста об отказе,
   *   остаётся город; человек нажмёт «Определить» вручную, когда захочет
   * @returns Promise<void>
   */
  async function useMyLocation(options: { silent?: boolean } = {}): Promise<void> {
    const silent = !!options.silent
    const position = await geolocation.requestGeolocation()

    if (!position) {
      if (!silent) {
        const reason = geolocation.error.value || 'Не удалось определить позицию'

        toast?.add({
          severity: 'warn',
          summary: 'Без геопозиции',
          detail: `${reason} — можно указать город и страну вручную, дистанция посчитается по ним`,
          life: 4000,
        })
      }

      return
    }

    const lat = Number(position.lat.toFixed(7))
    const lng = Number(position.lng.toFixed(7))

    let address = ''
    let city: string | null = null
    let country: string | null = null
    let countryCode: string | null = null

    try {
      const place = await reverseGeocodeHome(lat, lng)

      address = place.address
      city = place.city
      country = place.country
      countryCode = place.country_code
    } catch {
      address = `${lat}, ${lng}`
    }

    const current = values as Record<string, any>

    setValues({
      home_lat: lat,
      home_lng: lng,
      home_address: address || current.home_address,
      home_city: city || current.home_city,
      country: country || current.country,
      country_code: countryCode || current.country_code,
    } as any)

    toast?.add({
      severity: 'success',
      summary: 'Точка определена',
      detail: address === `${lat}, ${lng}`
        ? 'Адрес не нашёлся — расстояние всё равно будет считаться по координатам'
        : `Город и улица (или район): ${address}`,
      life: 4000,
    })
  }

  /**
   * Автозапуск определения точки при открытии профиля.
   *
   * Просим у браузера позицию сразу и тихо — ровно один системный
   * prompt с вкладки (это разрешено для geolocation). Человек уже
   * отказал (permissions: 'denied') — не дёргаемся: остаётся город
   * по умолчанию, точную точку он задаст кнопкой «Определить», когда
   * захочет. Точка уже задана — не переспрашиваем, чтобы не подменять
   * сохранённый адрес при каждом заходе.
   *
   * @returns Promise<void>
   */
  async function autoLocateHome(): Promise<void> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return
    }

    if (hasHomePoint.value || geolocation.loading.value) {
      return
    }

    if (navigator.permissions) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })

        if (status.state === 'denied') {
          return
        }
      } catch {
        // Safari и приватные режимы могут не поддерживать permissions API.
      }
    }

    await useMyLocation({ silent: true })
  }

  /**
   * Убрать точную домашнюю точку, оставив город и страну.
   *
   * @returns void
   */
  function clearMyLocation(): void {
    setValues({ home_lat: null, home_lng: null, home_address: null } as any)
  }

  /**
   * Выбрать страну проживания и сбросить старые координаты.
   *
   * Старая точка относится к прежней стране — после смены её нельзя
   * отправлять, иначе бэкенд отклонит сохранение как несовпадение.
   * Координаты заново подставит геолокация или геокодер по городу.
   *
   * @param countryName название страны из списка
   * @returns void
   */
  function setCountry(countryName: string): void {
    const current = values as Record<string, any>

    if (current.country === countryName) {
      return
    }

    const found = RESIDENCE_COUNTRIES.find((country) => country.name === countryName)

    setValues({
      country: countryName,
      country_code: found ? found.code : current.country_code,
      home_lat: null,
      home_lng: null,
      home_address: null,
    } as any)
  }

  const maxRadius = computed(() => maxHomeRadiusKm((values as any).plan || planOf(user.value)))

  /**
   * Смена почты: Free — одна смена за всю жизнь, Premium/Business —
   * три в месяц, персоналу — безлимит.
   *
   * can_change_email / email_changes_left — appended-атрибуты модели
   * User на бэке: quota ведётся сервером, фронт только показывает.
   */
  const canChangeEmail = computed(() => {
    const u = user.value
    if (!u) return false
    if (u.is_admin || u.role === 'admin' || u.role === 'moderator') return true
    return u.can_change_email !== false
  })

  /** null — безлимит (персонал), иначе сколько смен почты осталось до окна. */
  const emailChangesLeft = computed<number | null>(() => {
    const u = user.value
    if (!u) return null
    if (u.is_admin || u.role === 'admin' || u.role === 'moderator') return null
    return (u.email_changes_left ?? null) as number | null
  })

  /** Подсказка про смену почты под полем Email. */
  const emailChangeHint = computed(() => {
    if (!canChangeEmail.value) {
      return 'Смена почты исчерпана (1 раз бесплатно) — безлимит только на тарифе Premium'
    }
    if (emailChangesLeft.value === null) {
      return 'Безлимитная смена почты на твоём тарифе'
    }
    if (emailChangesLeft.value === 0) {
      return 'Лимит смен почты исчерпан — следующая смена в новом периоде'
    }
    return `Осталось смен почты: ${emailChangesLeft.value}`
  })

  /**
   * Смена имени: 1 раз бесплатно, безлимит — Premium/Business/стафф.
   *
   * can_change_name / name_changes_left — appended-атрибуты модели
   * User на бэке: они приходят во всех payload'ах пользователя.
   */
  const canChangeName = computed(() => {
    const u = user.value
    if (!u) return true
    return u.can_change_name !== false
  })

  /** null — безлимит (Premium/Business/стафф), иначе сколько бесплатных смен осталось. */
  const nameChangesLeft = computed<number | null>(() => {
    const u = user.value
    return u ? ((u.name_changes_left ?? 1) as number | null) : null
  })

  /** Подсказка про смену имени: безлимит / осталась одна / исчерпано. */
  const nameChangeHint = computed(() => {
    if (!canChangeName.value) {
      return 'Смена имени исчерпана (1 раз бесплатно) — безлимит только на Premium'
    }
    if (nameChangesLeft.value === null) {
      return 'Безлимитна смена имени на твоём тарифе'
    }
    return nameChangesLeft.value > 0
      ? `Осталась ${nameChangesLeft.value} бесплатная смена имени · безлимит — на Premium`
      : 'Осталась бесплатная смена имени'
  })

  watch(() => (values as any).plan, (pl) => {
    const m = maxHomeRadiusKm(pl || 'free')
    const cur = Number((values as any).home_radius_km ?? 1)
    if (cur > m) setValues({ home_radius_km: m } as any)
  })

  const residenceCheck = useCountryMismatch(() => ({
    country: (values as any).country,
    country_code: (values as any).country_code,
    lat: (values as any).home_lat,
    lng: (values as any).home_lng,
  }))

  /** Ключи формы, участвующие в сохранении (plan — только для UI-лимитов). */
  const dirtyKeys = [
    'name',
    'gender',
    'birth_date',
    'country',
    'country_code',
    'email',
    'home_lat',
    'home_lng',
    'home_city',
    'home_address',
    'home_visibility',
    'home_show_exact',
    'home_radius_km',
    'bio',
    'is_anonymous_default',
  ]

  const submit = handleSubmit(async (vals: any) => {
    const payload: any = { ...vals }
    if (typeof payload.bio === 'string') {
      const t = payload.bio.trim()
      payload.bio = t === '' ? null : t
    }
    if (payload.bio === '') payload.bio = null
    if (payload.country_code) payload.country_code = normalizeCountryCode(payload.country_code)
    if (payload.birth_date === '') payload.birth_date = null
    if (isUnchangedPayload(payload, user.value ?? {}, dirtyKeys)) {
      toast?.add({ severity: 'info', summary: 'Без изменений', detail: 'Нечего сохранять', life: 2000 })
      return
    }
    if (!isAdmin.value) {
      const residenceOk = await residenceCheck.recheckCountry()
      if (!residenceOk) {
        const msg = residenceCheck.countryWarning.value || 'Страна не совпадает с геолокацией'
        setErrors({ country: msg })
        toast?.add({ severity: 'error', summary: 'Сохранение запрещено', detail: msg, life: 4000 })
        return
      }
    }
    router.patch(route('profile.update'), payload, {
      preserveScroll: true,
      onSuccess: (responsePage: any) => {
        const fresh = (responsePage?.props?.auth as any)?.user ?? user.value
        // Новый baseline: форма чистая относительно свежих данных,
        // следующие фоновые обновления снова синхронизируются.
        try {
          resetForm({ values: mapUserToValues(fresh) as any })
        } catch {}
        toast?.add({ severity: 'success', summary: 'Профиль сохранён', life: 2000 })
      },
      onError: (e: any) => {
        try { setErrors(e) } catch {}
        toast?.add({ severity: 'error', summary: 'Ошибка', detail: Object.values(e || {}).flat().join(', ') || 'Не удалось сохранить', life: 3000 })
      },
    })
  })

  /**
   * Задана ли точка для расчёта расстояний.
   *
   * Координаты могут прийти строкой (decimal-каст Laravel), поэтому
   * проверяем через Number. Пустая строка и null — точки нет.
   *
   * @returns true если home_lat и home_lng валидны
   */
  const hasHomePoint = computed<boolean>(() => {
    const lat = (values as any).home_lat
    const lng = (values as any).home_lng

    if (lat == null || lat === '' || lng == null || lng === '') {
      return false
    }

    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
  })

  /**
   * Человеческая подпись локации для карточки в профиле.
   *
   * В профиле показываем только город — улица/район хранится в
   * home_address и используется для дистанций свайпов, не для
   * отображения. Координаты и сырой адрес пользователю не интересны.
   *
   * @returns подпись карточки: город, либо нейтральный вариант
   */
  const homeLocationLabel = computed<string>(() => {
    const city = String((values as any).home_city ?? '').trim()
    const country = String((values as any).country ?? '').trim()

    if (city !== '') {
      return city
    }

    if (country !== '') {
      return country
    }

    return hasHomePoint.value ? 'Моя локация' : 'Не определена'
  })

  const age = useUserAge(() => (values as any).birth_date)
  const isAdmin = computed(() => !!user.value?.is_admin || user.value?.role === 'admin')
  const countryWarning = computed(() => (isAdmin.value ? null : residenceCheck.countryWarning.value))
  const checkingCountry = computed(() => (isAdmin.value ? false : residenceCheck.checkingCountry.value))

  // Форма открылась в браузере — точку определяем автоматически,
  // ещё до нажатия «Определить». Отказ и ошибки — молча, см. autoLocateHome.
  void autoLocateHome()

  return { user, name, nameAttrs, gender, birth_date, age: age.age, ageLabel: age.label, country, country_code, email, emailAttrs, canChangeEmail, emailChangesLeft, emailChangeHint, canChangeName, nameChangesLeft, nameChangeHint, home_lat, homeLatAttrs, home_lng, homeLngAttrs, home_city, home_address, home_visibility, home_show_exact, home_radius_km, bio, is_anonymous_default, plan, errors, values, setValues, setErrors, submit, isSubmitting, useMyLocation, homeLocating: geolocation.loading, clearMyLocation, setCountry, maxRadius, homeLocation, hasHomePoint, homeLocationLabel, countryWarning, checkingCountry }
}
