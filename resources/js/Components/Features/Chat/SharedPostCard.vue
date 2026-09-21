<script setup lang="ts">
import { computed } from 'vue'
import { router } from '@inertiajs/vue3'
import type { SharedPostPayload } from '@/types/entities/Chat'

const props = defineProps<{ post: SharedPostPayload; own?: boolean }>()

const isDistrict = computed(() => props.post.type === 'district')
const isUnavailable = computed(() => !!(props.post as { unavailable?: boolean }).unavailable)

/**
 * Провалиться в пост по клику на превью.
 */
function openPost(): void {
  if (isUnavailable.value) {
    return
  }
  if (props.post.url) {
    router.visit(props.post.url)
    return
  }
  if (props.post.type === 'flow') {
    router.visit(`/flow/post/${props.post.id}`)
  }
}
</script>

<template>
  <button
    type="button"
    :disabled="isUnavailable"
    class="block w-full min-w-0 overflow-hidden rounded-xl border text-left transition active:scale-[0.99]"
    :class="[
      own
        ? 'border-white/30 bg-black/15 hover:bg-black/20'
        : 'border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 hover:border-violet-300 dark:hover:border-violet-500',
      isUnavailable ? 'opacity-70 cursor-default' : 'cursor-pointer',
    ]"
    @click="openPost"
  >
    <div v-if="isDistrict && post.district_name" class="flex items-center gap-1.5 px-2.5 pt-2">
      <i class="pi pi-megaphone text-[11px]" :style="{ color: own ? 'inherit' : '#8b5cf6' }" />
      <span class="truncate text-[11px] font-bold uppercase tracking-wide opacity-80">{{ post.district_name }}</span>
    </div>
    <div v-if="isUnavailable" class="px-2.5 py-2 text-xs opacity-70">Пост удалён или недоступен</div>
    <template v-else>
      <img
        v-if="post.image_url"
        :src="post.image_url"
        alt="Превью поста"
        loading="lazy"
        class="mt-1.5 max-h-48 w-full object-cover"
      />
      <div class="px-2.5 py-2">
        <div v-if="post.title" class="truncate text-[13px] font-bold leading-snug">{{ post.title }}</div>
        <div v-if="post.excerpt" class="mt-0.5 line-clamp-3 text-xs leading-relaxed opacity-90">{{ post.excerpt }}</div>
        <div class="mt-1.5 flex items-center gap-1 text-[11px] font-semibold opacity-80">
          <i class="pi pi-user text-[10px]" />
          <span class="truncate">{{ post.author_name || 'Автор' }}</span>
          <span class="ml-auto inline-flex shrink-0 items-center gap-1 font-bold">
            Открыть <i class="pi pi-angle-right text-[10px]" />
          </span>
        </div>
      </div>
    </template>
  </button>
</template>
