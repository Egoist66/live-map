import { ref, computed } from 'vue'

export function useBioEditor(initial: string | null = null) {
  const editorRef = ref<HTMLElement | null>(null)
  const html = ref(initial || '')
  const linkUrl = ref('')
  const showLink = ref(false)

  const empty = computed(() => !html.value || html.value.replace(/<[^>]*>/g, '').trim().length === 0)
  const charCount = computed(() => (html.value.replace(/<[^>]*>/g, '').length))
  const charOk = computed(() => charCount.value <= 8000)

  function exec(cmd: string, val?: string) {
    document.execCommand(cmd, false, val)
    sync()
  }

  function sync() {
    if (editorRef.value) html.value = editorRef.value.innerHTML
  }

  function onInput() { sync() }

  function toggle(b: 'bold' | 'italic' | 'underline' | 'strikeThrough') { exec(b) }
  function heading(tag: 'h2' | 'h3' | 'p') { exec('formatBlock', `<${tag}>`) }
  function bullet() { exec('insertUnorderedList') }
  function ordered() { exec('insertOrderedList') }
  function quote() { exec('formatBlock', '<blockquote>') }
  function clear() { exec('removeFormat'); exec('formatBlock', '<p>') }

  function insertLink() {
    if (!linkUrl.value) return
    const url = linkUrl.value.startsWith('http') || linkUrl.value.startsWith('mailto:') || linkUrl.value.startsWith('/') || linkUrl.value.startsWith('#') ? linkUrl.value : `https://${linkUrl.value}`
    exec('createLink', url)
    showLink.value = false
    linkUrl.value = ''
  }

  function sanitize(dirty: string): string {
    if (typeof document === 'undefined') return dirty
    const tpl = document.createElement('div')
    tpl.innerHTML = dirty
    const allowed = new Set(['P','BR','B','STRONG','I','EM','U','S','A','UL','OL','LI','H2','H3','BLOCKQUOTE','CODE','PRE','SPAN','DIV'])
    const walk = (node: Element) => {
      Array.from(node.children).forEach(el => {
        if (!allowed.has(el.tagName)) {
          el.replaceWith(...Array.from(el.childNodes))
          return
        }
        Array.from(el.attributes).forEach(a => {
          if (a.name.startsWith('on') || (el.tagName === 'A' && a.name === 'href' && /javascript:/i.test(a.value))) el.removeAttribute(a.name)
          if (el.tagName !== 'A' && a.name === 'href') el.removeAttribute(a.name)
          if (!['href','target','rel'].includes(a.name)) {
            if (a.name !== 'href') el.removeAttribute(a.name)
          }
        })
        if (el.tagName === 'A') { el.setAttribute('target','_blank'); el.setAttribute('rel','noopener') }
        walk(el)
      })
    }
    walk(tpl)
    return tpl.innerHTML
  }

  const sanitized = computed(() => sanitize(html.value))

  return { editorRef, html, sanitized, empty, charCount, charOk, linkUrl, showLink, onInput, sync, toggle, heading, bullet, ordered, quote, clear, insertLink, sanitize }
}
