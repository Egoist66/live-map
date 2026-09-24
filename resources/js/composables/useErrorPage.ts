import { computed } from 'vue'
import { router } from '@inertiajs/vue3'

/**
 * Контент тематичной страницы ошибки по HTTP-статусу.
 */
export interface ErrorPageContent {
  /** Крупный код на экране */
  code: string
  /** Заголовок */
  title: string
  /** Подсказка что случилось */
  hint: string
  /** Эмодзи-значок */
  emoji: string
}

const CONTENT: Record<number, ErrorPageContent> = {
  403: {
    code: '403',
    title: 'Сюда нельзя',
    hint: 'Этот раздел не для твоего аккаунта. Если кажется, что это ошибка — напиши нам.',
    emoji: '🔒',
  },
  404: {
    code: '404',
    title: 'Такой страницы нет',
    hint: 'Похоже, ссылка устарела или раздел переехал. Ничего страшного — вернём тебя к своим.',
    emoji: '🧭',
  },
  419: {
    code: '419',
    title: 'Сессия остыла',
    hint: 'Давно не заходил — обнови страницу и попробуй ещё раз.',
    emoji: '☕',
  },
  500: {
    code: '500',
    title: 'Что-то сломалось',
    hint: 'Мы уже чиним. Попробуй обновить страницу чуть позже.',
    emoji: '🛠️',
  },
  503: {
    code: '503',
    title: 'На обслуживании',
    hint: 'Короткие работы — скоро всё вернётся. Загляни через пару минут.',
    emoji: '🚧',
  },
}

const FALLBACK: ErrorPageContent = {
  code: 'Упс',
  title: 'Что-то пошло не так',
  hint: 'Попробуй вернуться назад или зайти в профиль.',
  emoji: '🛰️',
}

/**
 * Логика страницы ошибки (компонент только отображает).
 *
 * Главная кнопка ведёт в профиль, запасная — назад по истории
 * (если истории нет — тоже в профиль).
 *
 * @param status HTTP-статус от сервера (по умолчанию 404)
 * @returns контент и действия страницы
 * @example
 * const page = useErrorPage(404)
 * await page.goProfile()
 */
export function useErrorPage(status?: number | string) {
  const code = computed(() => {
    const parsed = Number(status)

    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 404
  })

  const content = computed<ErrorPageContent>(() => {
    const known = CONTENT[code.value]

    if (known) {
      return known
    }

    return { ...FALLBACK, code: String(code.value) }
  })

  /**
   * Вернуть пользователя в его профиль.
   */
  function goProfile(): void {
    try {
      router.visit('/profile')
    } catch {
      try {
        window.location.assign('/profile')
      } catch {
      }
    }
  }

  /**
   * Вернуться на предыдущий экран (или в профиль, если некуда).
   */
  function goBack(): void {
    try {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back()
        return
      }
    } catch {
    }

    goProfile()
  }

  return { code, content, goProfile, goBack }
}
