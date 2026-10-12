/**
 * Мини-markdown для ответов AI-гида: жирный, курсив, код, списки,
 * цитаты, заголовки, ссылки. Без внешних либ — ответы короткие
 * и предсказуемые, тащить marked ради чата избыточно.
 *
 * Порядок: сначала экранируем весь HTML, потом размечаем markdown
 * в безопасные теги, в конце — санитайзер-уборка по allowlist
 * (как в `useBioEditor`, только строже: без DIV/SPAN/H2).
 *
 * @example
 * import { renderAiMarkdown } from '@/composables/useAiMarkdown'
 * <p v-html="renderAiMarkdown(msg.text)"></p>
 */

/** Теги, которым разрешено пережить санитайзер. */
const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'UL',
  'OL',
  'LI',
  'H4',
  'BLOCKQUOTE',
  'CODE',
  'PRE',
  'A',
])

/**
 * Экранирует HTML-спецсимволы сырого текста.
 * @param raw сырой текст
 * @returns текст без живого HTML
 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Инлайн-разметка одной строки: код, ссылки, жирный, курсив.
 * Вход уже экранирован, собираем только свои теги.
 * @param line экранированная строка
 * @returns строка с инлайн-тегами
 */
function renderInline(line: string): string {
  const codes: string[] = []

  const noCode = line.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codes.push(`<code>${code}</code>`)
    return `\u0000${codes.length - 1}\u0000`
  })

  const withLinks = noCode.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)\)/g,
    (_m, text: string, href: string) => {
      const safe = /^(https?:\/\/|mailto:|\/)/i.test(href) ? href : '#'
      return `<a href="${safe}">${text}</a>`
    },
  )

  const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  const withItalic = withBold
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')

  return withItalic.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)] ?? '')
}

/**
 * Убирает из HTML всё вне allowlist: чужие теги разворачивает
 * в текст, у своих чистит атрибуты и on*-хендлеры.
 * @param dirty HTML после markdown-разметки
 * @returns чистый HTML для v-html
 */
function sanitizeAiHtml(dirty: string): string {
  if (typeof document === 'undefined') {
    return dirty
  }

  const tpl = document.createElement('div')
  tpl.innerHTML = dirty

  const walk = (node: Element): void => {
    Array.from(node.children).forEach((el) => {
      if (!ALLOWED_TAGS.has(el.tagName)) {
        el.replaceWith(...Array.from(el.childNodes))
        return
      }

      Array.from(el.attributes).forEach((attr) => {
        const isEvent = attr.name.startsWith('on')
        const isJsLink = el.tagName === 'A' && attr.name === 'href' && /javascript:/i.test(attr.value)
        const isAllowedLink = el.tagName === 'A' && ['href', 'target', 'rel'].includes(attr.name)

        if (isEvent || isJsLink || !isAllowedLink) {
          el.removeAttribute(attr.name)
        }
      })

      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener')
      }

      walk(el)
    })
  }

  walk(tpl)

  return tpl.innerHTML
}

/**
 * Рендерит ответ AI в безопасный HTML: абзацы, списки, цитаты,
 * подзаголовки, код-блоки. Пустой вход даёт пустую строку.
 * @param text сырой текст ответа
 * @returns безопасный HTML для v-html
 */
export function renderAiMarkdown(text: string): string {
  const source = (text ?? '').replace(/\r\n/g, '\n')

  if (source.trim() === '') {
    return ''
  }

  const escaped = escapeHtml(source)
  const blocks: string[] = []
  const lines = escaped.split('\n')

  let listKind: 'ul' | 'ol' | null = null
  let paragraph: string[] = []

  const flushParagraph = (): void => {
    if (paragraph.length === 0) {
      return
    }

    blocks.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`)
    paragraph = []
  }

  const flushList = (): void => {
    if (listKind) {
      blocks.push(`</${listKind}>`)
      listKind = null
    }
  }

  const openList = (kind: 'ul' | 'ol'): void => {
    flushParagraph()

    if (listKind !== kind) {
      flushList()
      blocks.push(`<${kind}>`)
      listKind = kind
    }
  }

  let inCode = false
  let codeBody: string[] = []

  for (const line of lines) {
    const fence = line.trim() === '```'

    if (fence) {
      if (inCode) {
        blocks.push(`<pre><code>${codeBody.join('\n')}</code></pre>`)
        codeBody = []
        inCode = false
      } else {
        flushParagraph()
        flushList()
        inCode = true
      }

      continue
    }

    if (inCode) {
      codeBody.push(line)
      continue
    }

    const trimmed = line.trim()

    if (trimmed === '') {
      flushParagraph()
      flushList()
      continue
    }

    const heading = trimmed.match(/^#{1,3}\s+(.+)$/)

    if (heading) {
      flushParagraph()
      flushList()
      blocks.push(`<h4>${renderInline(heading[1])}</h4>`)
      continue
    }

    const quote = trimmed.match(/^&gt;\s?(.*)$/)

    if (quote) {
      flushParagraph()
      flushList()
      blocks.push(`<blockquote>${renderInline(quote[1])}</blockquote>`)
      continue
    }

    const bullet = trimmed.match(/^[-*•]\s+(.+)$/)

    if (bullet) {
      openList('ul')
      blocks.push(`<li>${renderInline(bullet[1])}</li>`)
      continue
    }

    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/)

    if (ordered) {
      openList('ol')
      blocks.push(`<li>${renderInline(ordered[1])}</li>`)
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }

  if (inCode) {
    blocks.push(`<pre><code>${codeBody.join('\n')}</code></pre>`)
  }

  flushParagraph()
  flushList()

  return sanitizeAiHtml(blocks.join(''))
}
