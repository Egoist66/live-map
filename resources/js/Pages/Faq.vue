<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { useSeo } from '@/composables/useSeo'
import { useFaq } from '@/composables/useFaq'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'

const seo = useSeo({
  title: 'FAQ — Как устроен ULove | Вопросы и ответы',
  description: 'Ответы про ULove простым языком: свайпы, мэтчи и чат, суперлайки и буст, приватность 18+, тарифы и новости приложения.',
  keywords: ['ULove FAQ','что такое ULove','знакомства рядом','свайпы','мэтч','приватность','тарифы'],
})
const { open, sections } = useFaq()
</script>

<template>
  <Head :title="seo.title.value">
    <meta head-key="description" name="description" :content="seo.description.value" />
    <component :is="'script'" type="application/ld+json" v-html="JSON.stringify({ '@context':'https://schema.org','@type':'FAQPage', mainEntity: sections.map(s=>({ '@type':'Question', name:s.q, acceptedAnswer:{ '@type':'Answer', text:s.a }})) })"></component>
  </Head>
  <div class="page-scroll bg-surface dark:bg-[#0F121F]">
      <div class="max-w-[900px] xl:max-w-[1020px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[calc(2rem+var(--sab))]">
        <div class="text-center">
          <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-700 !rounded-full !shadow-soft !inline-flex">
            <template #content>
              <div class="flex items-center gap-2 px-1 py-0 text-xs font-semibold"><span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> FAQ · просто о сложном</div>
            </template>
          </Card>
          <h1 class="mt-4 text-[28px] sm:text-[42px] font-black tracking-[-0.04em] leading-[1.05] sm:leading-none dark:text-white text-balance">Как устроен <span class="bg-gradient-to-r from-[#FD267D] to-[#FF7854] bg-clip-text text-transparent">ULove</span></h1>
          <p class="mt-3 text-stone-600 dark:text-zinc-400 max-w-[640px] mx-auto">Знакомства рядом: свайпы, мэтчи и чат. Не нашёл ответа — напиши нам, разберём.</p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/swipes"><Button label="Открыть знакомства" class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !px-6 !py-2.5 !rounded-full !text-sm !font-semibold !border-0" /></Link>
            <a href="#faq"><Button label="Читать ниже" severity="secondary" outlined class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-700 !px-6 !py-2.5 !rounded-full !text-sm !font-semibold !text-ink-900 dark:!text-white" /></a>
          </div>
        </div>

        <div id="faq" class="mt-8">
          <Accordion v-model:value="open" class="!flex !flex-col !gap-3">
            <AccordionPanel v-for="s in sections" :key="s.id" :value="s.id" :id="`faq-${s.id}`" class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft overflow-hidden card-hover !mb-0 !scroll-mt-24">
              <AccordionHeader class="!p-0 !bg-transparent !border-0">
                <div class="w-full flex items-center gap-4 p-5 text-left">
                  <span class="w-10 h-10 rounded-xl bg-ink-900 dark:bg-zinc-800 text-white grid place-items-center text-sm card-icon shrink-0">{{ s.icon }}</span>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-bold tracking-widest uppercase text-stone-400">{{ s.title }}</div>
                    <div class="text-[15px] font-bold leading-tight dark:text-white">{{ s.q }}</div>
                  </div>
                </div>
              </AccordionHeader>
              <AccordionContent class="!p-0 !bg-transparent !border-0">
                <div class="px-5 pb-5">
                  <div class="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4 text-sm leading-relaxed text-stone-700 dark:text-zinc-300 whitespace-pre-wrap">{{ s.a }}</div>
                </div>
              </AccordionContent>
            </AccordionPanel>
          </Accordion>
        </div>

        <div class="mt-6 bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="min-w-0"><div class="font-black">Остались вопросы?</div><div class="text-sm text-white/60">Напиши нам через контакты — ответим и поможем.</div></div>
          <Link href="/contacts" class="w-full sm:w-auto shrink-0"><Button label="Написать нам" class="w-full sm:w-auto !bg-white !text-ink-900 !px-6 !py-2.5 !rounded-full !font-bold !border-0" /></Link>
        </div>
      </div>
    </div>
</template>
