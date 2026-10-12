<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useContentModeration, isStaffViewer, type ModerationFlags } from '@/composables/useContentModeration'

/**
 * Блюр-обёртка токсичного публичного контента.
 *
 * Показывает текст заблюренным с причиной и кнопкой «Показать».
 * AI-доанализ включается лениво (checkAi) — только для текстов,
 * которые локальный regex не зафлаговал, чтобы не жечь квоту.
 * В чатах не используется: личная переписка не модерируется.
 *
 * @example
 * <ModeratedContent :text="post.body" :moderation="post.moderation" />
 */
const props = withDefaults(defineProps<{
  text: string
  moderation?: ModerationFlags | null
  checkAi?: boolean
  compact?: boolean
}>(), { moderation: null, checkAi: false, compact: false })

const mod = useContentModeration()
const revealed = ref(false)
const aiVerdict = ref<{ is_toxic: boolean; reason: string | null } | null>(null)
const aiLoading = ref(false)
let aiDone = false

const baseFlags = computed<ModerationFlags>(() => mod.moderationOf(props.text, props.moderation))

const effectiveBlur = computed(() => {
  if (revealed.value) return false
  if (baseFlags.value.blur) return true
  if (aiVerdict.value?.is_toxic) return true
  return false
})

const reasonLabel = computed(() => {
  if (aiVerdict.value?.is_toxic) return aiVerdict.value.reason || 'AI-модерация'
  return baseFlags.value.label || 'Нарушение правил'
})

async function runAiCheck(): Promise<void> {
  if (!props.checkAi || aiDone || baseFlags.value.blur) return
  if (isStaffViewer()) return
  const text = (props.text || '').trim()
  if (text.length < 8) return
  aiDone = true
  aiLoading.value = true
  try {
    const verdict = await mod.checkViaAi(text)
    aiVerdict.value = { is_toxic: verdict.is_toxic, reason: verdict.reason }
  } finally {
    aiLoading.value = false
  }
}

watch(() => props.text, () => {
  revealed.value = false
  aiVerdict.value = null
  aiDone = false
  void runAiCheck()
}, { immediate: true })

function toggle(): void {
  revealed.value = !revealed.value
}
</script>

<template>
  <div class="moderated-wrap min-w-0">
    <div v-if="effectiveBlur" class="relative overflow-hidden rounded-xl">
      <div
        class="moderated-blurred break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]"
        aria-hidden="true"
      ><slot>{{ text }}</slot></div>
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 p-3 text-center backdrop-blur-[2px] dark:bg-zinc-950/60">
        <Tag severity="warn" class="!text-[11px">
          <template #icon><i class="pi pi-eye-slash text-[11px]" /></template>
          {{ reasonLabel }} — скрыто
        </Tag>
        <Button
          label="Показать"
          icon="pi pi-eye"
          size="small"
          rounded
          outlined
          :loading="aiLoading"
          class="!text-xs"
          @click="toggle"
        />
      </div>
    </div>
    <div v-else class="min-w-0">
      <div class="whitespace-pre-line break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]"><slot>{{ text }}</slot></div>
      <div v-if="(baseFlags.blur || aiVerdict?.is_toxic) && revealed" class="mt-1.5 flex items-center gap-2">
        <Tag severity="warn" class="!text-[10px]">{{ reasonLabel }}</Tag>
        <Button label="Скрыть" link size="small" class="!p-0 !text-xs" @click="toggle" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.moderated-blurred {
  filter: blur(8px);
  user-select: none;
  pointer-events: none;
}
@media (max-width: 640px) {
  .moderated-blurred {
    filter: blur(6px);
  }
}
</style>
