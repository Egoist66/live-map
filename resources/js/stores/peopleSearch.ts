import { defineStore } from 'pinia'
import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'

/**
 * Глобальный поиск людей по приложению для Ctrl+K.
 *
 * Держит состояние диалога, строку запроса и результаты
 * поиска через `/api/chat/users/search`.
 */
export const usePeopleSearchStore = defineStore('peopleSearch', () => {
  const open = ref(false)
  const query = ref('')
  const results = ref<any[]>([])
  const searching = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0

  /**
   * Открыть глобальный диалог поиска.
   */
  function openDialog(): void {
    open.value = true
  }

  /**
   * Закрыть диалог и сбросить запрос.
   */
  function closeDialog(): void {
    open.value = false
    query.value = ''
    results.value = []
    searching.value = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    seq += 1
  }

  /**
   * Установить запрос с дебаунсом 300мс.
   * @param value новая строка поиска
   */
  function setQuery(value: string): void {
    query.value = value

    const trimmed = value.trim()

    if (trimmed.length < 2) {
      results.value = []
      searching.value = false
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      return
    }

    if (timer) {
      clearTimeout(timer)
    }

    searching.value = true

    const current = ++seq

    timer = setTimeout(async () => {
      try {
        const data = await chatApi.search(trimmed)
        if (current !== seq) {
          return
        }
        results.value = (data as any[]) ?? []
      } catch {
        if (current !== seq) {
          return
        }
        results.value = []
      } finally {
        if (current === seq) {
          searching.value = false
        }
      }
    }, 300)
  }

  return {
    open,
    query,
    results,
    searching,
    openDialog,
    closeDialog,
    setQuery,
  }
})
