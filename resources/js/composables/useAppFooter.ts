import { computed } from 'vue'

/**
 * Хук для ссылок подвала сайта.
 * @returns Список ссылок футера.
 * @example const { footerLinks } = useAppFooter()
 */
export function useAppFooter() {
  const footerLinks = computed(() => [
    { label: 'FAQ', href: '/faq' },
    { label: 'Контакты', href: '/contacts' },
    { label: 'Политика конфиденциальности', href: '/privacy' },
    { label: 'Публичная оферта', href: '/offer' },
  ])

  return { footerLinks }
}
