<script setup lang="ts">
import { watch, onMounted } from 'vue'
import { useBioEditor } from '@/composables/useBioEditor'

const props = defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ (e:'update:modelValue', v:string):void }>()

const e = useBioEditor(props.modelValue)

onMounted(() => {
  if (e.editorRef.value) e.editorRef.value.innerHTML = props.modelValue || ''
})

watch(() => props.modelValue, v => {
  const next = v || ''
  if (e.html.value !== next) e.html.value = next
  if (e.editorRef.value && e.editorRef.value.innerHTML !== next) e.editorRef.value.innerHTML = next
})

watch(() => e.html.value, v => {
  if (v !== props.modelValue) emit('update:modelValue', v)
}, { flush: 'sync' })

function syncAndEmit() {
  e.sync()
  const v = e.html.value
  if (v !== props.modelValue) emit('update:modelValue', v)
}

function act(fn: () => void){
  e.editorRef.value?.focus()
  fn()
  setTimeout(syncAndEmit, 0)
}
</script>

<template>
  <div class="border border-stone-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
    <div class="flex flex-wrap items-center gap-1 p-2 bg-stone-50 dark:bg-zinc-800 border-b border-stone-200 dark:border-zinc-700">
      <button type="button" @click="act(()=>e.toggle('bold'))" class="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 border border-transparent hover:border-stone-200 font-black text-sm">B</button>
      <button type="button" @click="act(()=>e.toggle('italic'))" class="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 border border-transparent hover:border-stone-200 italic text-sm">I</button>
      <button type="button" @click="act(()=>e.toggle('underline'))" class="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 border border-transparent hover:border-stone-200 underline text-sm">U</button>
      <button type="button" @click="act(()=>e.toggle('strikeThrough'))" class="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 border border-transparent hover:border-stone-200 line-through text-sm">S</button>
      <span class="w-px h-6 bg-stone-200 dark:bg-zinc-600 mx-1"></span>
      <button type="button" @click="act(()=>e.heading('h2'))" class="px-2 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 border border-transparent hover:border-stone-200 text-xs font-bold">H2</button>
      <button type="button" @click="act(()=>e.heading('h3'))" class="px-2 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 border border-transparent hover:border-stone-200 text-xs font-bold">H3</button>
      <button type="button" @click="act(()=>e.heading('p'))" class="px-2 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 border border-transparent hover:border-stone-200 text-xs">P</button>
      <span class="w-px h-6 bg-stone-200 dark:bg-zinc-600 mx-1"></span>
      <button type="button" @click="act(()=>e.bullet())" class="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-sm">•≡</button>
      <button type="button" @click="act(()=>e.ordered())" class="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-sm">1.</button>
      <button type="button" @click="act(()=>e.quote())" class="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-sm">❝</button>
      <button type="button" @click="act(()=>e.showLink.value=!e.showLink.value)" class="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-sm">🔗</button>
      <button type="button" @click="act(()=>e.clear())" class="ml-auto px-2 h-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-xs">Очистить</button>
    </div>
    <div v-if="e.showLink.value" class="flex gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border-b border-stone-200 dark:border-zinc-700">
      <input v-model="e.linkUrl.value" placeholder="https://..." class="flex-1 rounded-xl border border-stone-200 dark:border-zinc-600 px-3 py-1.5 text-sm bg-white dark:bg-zinc-900" />
      <button type="button" @click="e.insertLink()" class="px-4 py-1.5 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 text-sm font-bold">Вставить</button>
      <button type="button" @click="e.showLink.value=false" class="px-3 py-1.5 text-sm">✕</button>
    </div>
    <div :ref="e.setEditorRef" contenteditable="true" @input="syncAndEmit()" @blur="syncAndEmit()" class="min-h-[160px] max-h-[320px] overflow-y-auto p-4 text-sm leading-relaxed outline-none prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-h2:text-base prose-h2:font-black prose-h3:text-sm prose-h3:font-bold prose-blockquote:border-l-2 prose-blockquote:border-stone-200 prose-blockquote:pl-3 prose-blockquote:italic prose-a:text-brand-600" :data-placeholder="e.empty.value ? 'Расскажи о себе — интересы, чем занимаешься...' : ''"></div>
    <div class="flex justify-between items-center px-3 py-2 bg-stone-50 dark:bg-zinc-800 border-t border-stone-200 dark:border-zinc-700 text-xs">
      <span :class="e.charOk.value ? 'text-stone-400' : 'text-red-500 font-bold'">{{ e.charCount.value }} / 8000</span>
      <span class="text-stone-400 hidden sm:inline">Выдели текст и жми форматирование · ссылки открываются в новой вкладке</span>
    </div>
  </div>
</template>

<style scoped>
[contenteditable]:empty:before{ content:attr(data-placeholder); color:#a8a29e; pointer-events:none }
.prose :where(blockquote){ margin:8px 0 }
</style>
