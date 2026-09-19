<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ text: string }>()

const emit = defineEmits<{
  (e: 'tag', name: string): void
}>()

type Segment = { key: number; tag: string | null; text: string }

/**
 * Режет текст на куски, выделяя #хэштеги в кликабельные чипы.
 * Упоминания @ остаются текстом (имена неоднозначны для ссылок).
 */
const segments = computed<Segment[]>(() => {
  const parts = String(props.text ?? '').split(/(#[\p{L}\p{N}_]{2,50})/u)
  return parts.map((text, key) => {
    const match = text.match(/^#([\p{L}\p{N}_]{2,50})$/u)
    return { key, tag: match ? match[1].toLowerCase() : null, text }
  })
})
</script>

<template>
  <span class="whitespace-pre-line break-words"><template v-for="s in segments" :key="s.key"><button v-if="s.tag" type="button" class="font-semibold text-sky-600 dark:text-sky-400 hover:underline" @click="emit('tag', s.tag)">#{{ s.tag }}</button><template v-else>{{ s.text }}</template></template></span>
</template>
