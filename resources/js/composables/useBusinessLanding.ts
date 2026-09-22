import { computed } from 'vue'
import { router } from '@inertiajs/vue3'

const CONTENT = {
  badge: 'UPIN PRO · ДЛЯ БИЗНЕСА',
  badgeNote: 'кабинет компании · проверка по УНП · клиенты с карты',
  titleTop: 'Клиенты рядом.',
  titleAccent: 'Официально.',
  description:
    'UPin Pro приводит клиентов с карты района: метка компании видна всем, пины больше и заметнее, проверка по УНП даёт бейдж доверия. Работаем по законодательству Республики Беларусь.',
  primaryLabel: 'Открыть кабинет →',
  secondaryLabel: 'У меня есть кабинет',
  trust: 'Проверка по УНП · Бейдж «Проверено» · Отмена в 1 клик',
  stats: [
    { value: '50 км', note: 'радиус видимости' },
    { value: '×1.45', note: 'пины заметнее' },
    { value: 'УНП', note: 'проверка РБ' },
  ],
  steps: [
    { icon: 'pi-id-card', title: '01 · Регистрация по УНП', text: 'Форма, УНП из 9 цифр и юридический адрес. Реквизиты подставятся в кабинет сами.' },
    { icon: 'pi-verified', title: '02 · Проверка и метка', text: 'После проверки компания появляется на карте у всех — особая метка со списком пинов.' },
    { icon: 'pi-chart-line', title: '03 · Клиенты и продвижение', text: 'Пины больше и пульсируют сильнее, promo-подпись завлекает. Статистика — в кабинете.' },
  ],
  tariff: {
    tag: '💼 ВИЗИТКА БИЗНЕСА · $9.99/МЕС',
    title: 'Платите за клиентов, а не за тариф.',
    text: 'Визитка: бессрочные пины, радиус 50 км, адрес, телефон, часы и бейдж «Проверено». Плюс поштучно: рекламный пин, пуш по району, купон с кнопкой «Маршрут».',
    chips: ['Бессрочные пины', 'Бейдж «Проверено»', 'Статистика просмотров'],
    ctaLabel: 'Создать кабинет →',
  },
  finalTitle: 'Готовы к клиентам с карты?',
  finalText: 'Регистрация компании за 3 минуты — дальше проверим УНП и включим метку.',
}

/**
 * Лендинг бизнеса: контент, CTA и SEO для гостей-компаний.
 *
 * Показывается вместо общего лендинга, когда гость уже выбрал
 * «Я — компания» (localStorage пережил и логаут). Возврат
 * к обычному лендингу — через switchToPerson().
 *
 * @returns контент, CTA, SEO и смена режима
 * @example const landing = useBusinessLanding()
 */
export function useBusinessLanding() {
  const primaryCta = computed(() => ({ href: '/register?account=business', label: CONTENT.primaryLabel }))
  const loginCta = computed(() => ({ href: '/login?account=business', label: CONTENT.secondaryLabel }))

  const seo = computed(() => ({
    title: 'UPin Pro — кабинет для бизнеса | Клиенты с карты',
    description:
      'UPin Pro для бизнеса: кабинет компании, проверка по УНП РБ, метка на карте, заметные пины и клиенты рядом.',
  }))

  /**
   * Вернуться к обычному лендингу персоны.
   */
  function switchToPerson(): void {
    try {
      window.localStorage.removeItem('upin_account_choice')
    } catch {}
    router.visit('/')
  }

  return { content: CONTENT, primaryCta, loginCta, seo, switchToPerson }
}
