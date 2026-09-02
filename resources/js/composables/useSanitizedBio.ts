import { computed } from 'vue'

const ALLOWED = new Set(['P','BR','B','STRONG','I','EM','U','S','A','UL','OL','LI','H2','H3','BLOCKQUOTE','CODE','PRE','SPAN','DIV'])

export function useSanitizedBio(source: () => string | null | undefined) {
  const html = computed(() => {
    const raw = source() || ''
    if (!raw) return ''
    if (typeof document === 'undefined') return raw
    const tpl = document.createElement('div')
    tpl.innerHTML = raw
    const walk = (node: Element) => {
      Array.from(node.children).forEach(el => {
        if (!ALLOWED.has(el.tagName)) { el.replaceWith(...Array.from(el.childNodes)); return }
        Array.from(el.attributes).forEach(a => {
          if (a.name.startsWith('on')) el.removeAttribute(a.name)
          if (/javascript:/i.test(a.value)) el.removeAttribute(a.name)
          if (el.tagName !== 'A' && a.name === 'href') el.removeAttribute(a.name)
          if (!['href','target','rel'].includes(a.name)) el.removeAttribute(a.name)
        })
        if (el.tagName === 'A') { el.setAttribute('target','_blank'); el.setAttribute('rel','noopener') }
        walk(el)
      })
    }
    walk(tpl)
    return tpl.innerHTML
  })
  const isEmpty = computed(() => !html.value || html.value.replace(/<[^>]*>/g,'').trim().length===0)
  return { html, isEmpty }
}
