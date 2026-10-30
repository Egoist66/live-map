<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import type { FlowCompany } from '@/types/flow'

const props = defineProps<{ company: FlowCompany }>()

/**
 * Витринное имя: бренд важнее юрназвания.
 */
const displayName = computed(() => {
  const brand = String(props.company?.brand ?? '').trim()
  if (brand !== '') {
    return brand
  }
  return String(props.company?.name ?? '').trim() || 'Компания'
})

const profileHref = computed(() => {
  const slug = String(props.company?.owner_profile ?? '').trim()
  return slug !== '' ? `/users/${slug}` : null
})
</script>
<template>
  <div class="flex items-center gap-3 min-w-0">
    <Avatar v-if="company.logo_url" :image="company.logo_url" shape="circle" class="!w-11 !h-11 [&_img]:object-cover" />
    <span v-else class="grid place-items-center !w-11 !h-11 rounded-full bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white text-xl shrink-0">🏢</span>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5 min-w-0">
        <Link v-if="profileHref" :href="profileHref" class="truncate text-[15px] font-bold text-ink-900 dark:text-white hover:underline">
          {{ displayName }}
        </Link>
        <span v-else class="truncate text-[15px] font-bold text-ink-900 dark:text-white">{{ displayName }}</span>
        <span v-if="company.is_verified" title="Проверенная компания" class="shrink-0 grid place-items-center w-[18px] h-[18px] rounded-full bg-emerald-500 text-white text-[11px] font-black">✓</span>
      </div>
      <span class="mt-0.5 inline-flex items-center gap-1 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 px-2 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
        <i class="pi pi-megaphone text-[10px]" />Новость компании
      </span>
    </div>
  </div>
</template>
