<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
const { isDark, toggle } = useTheme()
</script>
<template>
  <button @click="toggle" class="relative w-9 h-9 rounded-full bg-white dark:bg-white/[0.06] border border-stone-200 dark:border-white/10 shadow-soft grid place-items-center hover:bg-stone-50 dark:hover:bg-white/15 transition-all active:scale-95" :title="isDark ? 'Светлая тема' : 'Тёмная тема'">
    <svg v-if="!isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-ink-900"><path d="M12 3a6 6 0 0 0 9 9c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9Z"/></svg>
    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-400"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
  </button>
</template>
