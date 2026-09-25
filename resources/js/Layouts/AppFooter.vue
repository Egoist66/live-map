<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { useAppFooter } from '@/composables/useAppFooter'
import { useSupportEmail } from '@/composables/useSettingsSupport'

const { footerLinks } = useAppFooter()
const supportEmail = useSupportEmail()

/**
 * CTA сотрудничества: вместо бизнес-таба — красивая ссылка
 * «Сотрудничество» с почтой админа под капотом (mailto).
 */
const cooperationHref = computed(() => `mailto:${supportEmail}?subject=${encodeURIComponent('Сотрудничество с UPin')}`)
</script>

<template>
  <footer class="border-t border-stone-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur">
    <div class="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="text-xs text-stone-400 dark:text-zinc-500 tracking-wide order-2 sm:order-1">© UPin · Пилотный район</div>
      <nav aria-label="Справочная информация" class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 order-1 sm:order-2">
        <Link
          v-for="footerLink in footerLinks"
          :key="footerLink.href"
          :href="footerLink.href"
          class="text-xs font-medium text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white transition"
        >
          {{ footerLink.label }}
        </Link>
        <a
          :href="cooperationHref"
          class="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 border border-rose-200/80 dark:border-rose-400/25 bg-rose-50/70 dark:bg-rose-950/30 rounded-full px-3 py-1 transition"
        >
          <i class="pi pi-envelope text-[10px]" /> Сотрудничество
        </a>
      </nav>
    </div>
  </footer>
</template>
