import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'

export interface MentionUser {
  id: number
  name: string
  avatar_path?: string | null
  avatar_url?: string | null
}

const MENTION_RE = /@([\p{L}\p{N}_]+(?: [\p{L}\p{N}_]+)?)/gu
const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi

export function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function trimUrlEnd(url: string): string {
  let end = url.length
  while (end > 0 && '.,;:!?'.includes(url[end - 1])) end--
  let balance = 0
  for (let i = 0; i < end; i++) {
    if (url[i] === '(') balance++
    else if (url[i] === ')') balance--
  }
  while (end > 0 && url[end - 1] === ')' && balance < 0) {
    end--
    balance++
  }
  return url.slice(0, end)
}

function shortUrl(url: string): string {
  return url.length > 64 ? `${url.slice(0, 61)}…` : url
}

function linkTag(url: string): string {
  const safe = escapeHtml(url)
  return `<a href="${safe}" title="${safe}" target="_blank" rel="noopener noreferrer nofollow" class="rich-link">${escapeHtml(shortUrl(url))}</a>`
}

export function renderWithMentions(text: string): string {
  const src = text ?? ''
  const out: string[] = []
  let last = 0
  URL_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = URL_RE.exec(src)) !== null) {
    out.push(escapeHtml(src.slice(last, m.index)).replace(MENTION_RE, '<span class="mention">@$1</span>'))
    const clean = trimUrlEnd(m[0])
    const trail = m[0].slice(clean.length)
    if (/^https?:\/\/.+\..+/.test(clean)) {
      out.push(linkTag(clean))
      out.push(escapeHtml(trail).replace(MENTION_RE, '<span class="mention">@$1</span>'))
    } else {
      out.push(escapeHtml(m[0]).replace(MENTION_RE, '<span class="mention">@$1</span>'))
    }
    last = m.index + m[0].length
  }
  out.push(escapeHtml(src.slice(last)).replace(MENTION_RE, '<span class="mention">@$1</span>'))
  return out.join('')
}

export function useMentions() {
  const mentionOpen = ref(false)
  const mentionLoading = ref(false)
  const mentionResults = ref<MentionUser[]>([])
  let tokenStart = -1
  let tokenCursor = 0
  let timer: any = null

  function close() {
    mentionOpen.value = false
    mentionResults.value = []
    tokenStart = -1
    if (timer) clearTimeout(timer)
  }

  function detect(text: string, cursor?: number): void {
    const pos = cursor ?? (text ?? '').length
    const before = (text ?? '').slice(0, pos)
    const at = before.lastIndexOf('@')
    if (at < 0 || (at > 0 && !/[\s\n]/.test(before[at - 1]))) {
      close()
      return
    }
    const q = before.slice(at + 1)
    if (q.length > 30 || /[@\n]/.test(q) || /\s$/.test(q)) {
      close()
      return
    }
    tokenStart = at
    tokenCursor = pos
    const query = q.trim()
    if (query.length < 2) {
      mentionOpen.value = false
      mentionResults.value = []
      if (timer) clearTimeout(timer)
      return
    }
    mentionOpen.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      mentionLoading.value = true
      try {
        mentionResults.value = (await chatApi.search(query)) as MentionUser[]
      } catch {
        mentionResults.value = []
      } finally {
        mentionLoading.value = false
      }
    }, 300)
  }

  function applyMention(text: string, user: MentionUser): { text: string; cursor: number } {
    if (tokenStart < 0) return { text, cursor: (text ?? '').length }
    const insert = `@${user.name} `
    const next = (text ?? '').slice(0, tokenStart) + insert + (text ?? '').slice(tokenCursor)
    const cursor = tokenStart + insert.length
    close()
    return { text: next, cursor }
  }

  return { mentionOpen, mentionLoading, mentionResults, detect, applyMention, close }
}
