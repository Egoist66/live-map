<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import Card from 'primevue/card'
import { useAppFooter } from '@/composables/useAppFooter'
import { useModuleContent } from '@/composables/useModuleContent'

const { footerLinks } = useAppFooter()

/**
 * Бренд и подпись — из движка модулей, как в подвале сайта:
 * один ULove — «ULove · Знакомства рядом», после выпуска разделов
 * тексты подтянутся сами, руками ничего править не нужно.
 */
const content = useModuleContent()

/**
 * Версия приложения из серверных props (без опроса).
 */
const appVersion = computed(() => {
  try {
    const version = (usePage().props as Record<string, unknown>).appVersion
    return typeof version === 'string' && version !== '' ? version : null
  } catch {
    return null
  }
})

const icons: Record<string, string> = {
  '/faq': 'pi pi-question-circle',
  '/contacts': 'pi pi-envelope',
  '/privacy': 'pi pi-shield',
  '/offer': 'pi pi-file-edit',
}
</script>

<template>
  <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">О сервисе</h3>
      <p class="text-sm text-stone-500 mt-1">{{ content.multiModule.value ? 'Знакомства и встречи рядом: все включённые разделы — в меню. Справка, связь и документы — ниже.' : 'ULove — знакомства рядом: свайпы, мэтчи и чат. Справка, связь и документы — ниже.' }}</p>
      <nav aria-label="О сервисе" class="mt-5 flex flex-col gap-1.5">
        <Link
          v-for="footerLink in footerLinks"
          :key="footerLink.href"
          :href="footerLink.href"
          class="group flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-white/10 px-4 py-3 transition hover:border-violet-300 dark:hover:border-violet-500/40 active:scale-[0.99]"
        >
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300"><i :class="icons[footerLink.href] ?? 'pi pi-info-circle'" /></span>
          <span class="min-w-0 flex-1 truncate text-sm font-bold text-stone-800 dark:text-zinc-100">{{ footerLink.label }}</span>
          <i class="pi pi-angle-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
        </Link>
      </nav>
      <p class="mt-5 text-xs text-stone-400 dark:text-zinc-500">© {{ content.brand.value.head }}{{ content.brand.value.tail }} · {{ content.multiModule.value ? 'Знакомства и встречи рядом' : 'Знакомства рядом' }}<span v-if="appVersion"> · v{{ appVersion }}</span></p>
    </template>
  </Card>
</template>
