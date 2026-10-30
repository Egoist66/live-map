<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useContentModeration, type ModerationFlags } from '@/composables/useContentModeration'

/**
 * Блюр-обёртка токсичного публичного контента.
 *
 * Показывает текст заблюренным с причиной и кнопкой «Показать».
 * Проверка полностью локальная (серверные флаги + regex-зеркало Blasp):
 * сети нет, токены не тратятся.
 * В чатах не используется: личная переписка не модерируется.
 *
 * @example
 * <ModeratedContent :text="post.body" :moderation="post.moderation" />
 */
const props = withDefaults(defineProps<{
  text: string
  moderation?: ModerationFlags | null
  compact?: boolean
}>(), { moderation: null, compact: false })

const mod = useContentModeration()
const revealed = ref(false)

const baseFlags = computed<ModerationFlags>(() => mod.moderationOf(props.text, props.moderation))

const effectiveBlur = computed(() => {
  if (revealed.value) return false
  return baseFlags.value.blur
})

const reasonLabel = computed(() => baseFlags.value.label || 'Нарушение правил')

watch(() => props.text, () => {
  revealed.value = false
}, { immediate: false })

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
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 p-3 text-center backdrop-blur-[2px] dark:bg-black/20/60">
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
          class="!text-xs"
          @click="toggle"
        />
      </div>
    </div>
    <div v-else class="min-w-0">
      <div class="whitespace-pre-line break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]"><slot>{{ text }}</slot></div>
      <div v-if="baseFlags.blur && revealed" class="mt-1.5 flex items-center gap-2">
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
