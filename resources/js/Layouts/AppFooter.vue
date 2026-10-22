<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { useAppFooter } from '@/composables/useAppFooter'
import { useModuleContent } from '@/composables/useModuleContent'

const { footerLinks } = useAppFooter()
const content = useModuleContent()
</script>

<template>
  <footer class="border-t border-stone-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur">
    <div class="max-w-[1280px] xl:max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="text-xs text-stone-400 dark:text-zinc-500 tracking-wide order-2 sm:order-1">© {{ content.brand.value.head }}{{ content.brand.value.tail }} · Знакомства рядом</div>
      <nav aria-label="Справочная информация" class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 order-1 sm:order-2">
        <Link
          v-for="footerLink in footerLinks"
          :key="footerLink.href"
          :href="footerLink.href"
          class="text-xs font-medium text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white transition"
        >
          {{ footerLink.label }}
        </Link>
      </nav>
    </div>
  </footer>
</template>
