<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import Avatar from 'primevue/avatar'
import { useCachedImageSrc } from '@/composables/useImageBlobCache'
import { avatarSrcFor } from '@/composables/useAvatar'

/**
 * Аватар пользователя с бинарным IDB-кешем.
 *
 * Оборачивает PrimeVue `Avatar`: источник (фото пользователя или
 * SVG-заглушка) резолвится через `useCachedImageSrc` — хит отдаётся
 * objectURL'ом мгновенно и офлайн, промах тихо докачивается в фон.
 * Раньше все аватары ходили в сеть на каждый рендер.
 *
 * Все остальные пропсы/классы PrimeVue (`size`, `shape`, `pt`, class…)
 * прокидываются как есть через $attrs.
 *
 * @example
 * <UserAvatar :user="message.sender" shape="circle" class="!w-8 !h-8" />
 * <UserAvatar :src="customUrl" shape="circle" />
 */
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  /** Объект пользователя (ChatUserBrief, peer и т.п.). */
  user?: any
  /** Явный URL (заменяет резолвер по user). */
  src?: string | null
}>()

const attrs = useAttrs()

/**
 * Исходный URL: явный src важнее, затем резолвер по user, затем image из
 * $attrs (обратная совместимость с `<UserAvatar image="..." />`).
 */
const source = computed<string>(() => {
  if (props.src !== undefined) {
    return props.src ?? ''
  }
  if (props.user !== undefined) {
    return avatarSrcFor(props.user)
  }
  return typeof attrs.image === 'string' ? attrs.image : ''
})

const { src: image } = useCachedImageSrc(source, source.value)
</script>

<template>
  <Avatar v-bind="attrs" :image="image" />
</template>
