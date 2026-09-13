<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3'
import { computed, onMounted } from 'vue'
import GuestLayout from '@/Layouts/GuestLayout.vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { useSeo } from '@/composables/useSeo'
import { usePublicReference } from '@/composables/usePublicReference'
import Card from 'primevue/card'
import Button from 'primevue/button'

const props = defineProps<{ slug: string }>()

const seo = useSeo({
  title: 'Справочная информация UPin',
  description: 'Контакты, политика конфиденциальности и публичная оферта UPin.',
  keywords: ['UPin', 'контакты', 'политика конфиденциальности', 'оферта'],
})

const page = usePage()
const isAuth = computed(() => !!(page.props.auth as any)?.user)
const Layout = computed(() => (isAuth.value ? AuthenticatedLayout : GuestLayout))

const { page: refPage, loading, notFound, fallbackTitle, load } = usePublicReference(props.slug)

const pageTitle = computed(() => refPage.value?.title ?? fallbackTitle.value)
const companyMeta = computed(() => refPage.value?.meta ?? null)
const attachments = computed(() => refPage.value?.attachments ?? [])

const hasCompanyBlock = computed(() => {
  const meta = companyMeta.value
  return !!(meta?.company_name || meta?.inn || meta?.ogrn || meta?.address || meta?.email || meta?.phone)
})

onMounted(() => load())
</script>

<template>
  <Head :title="seo.title.value">
    <meta head-key="description" name="description" :content="seo.description.value" />
  </Head>
  <component :is="Layout">
    <div class="page-scroll bg-surface dark:bg-[#090E1A]">
      <div class="max-w-[900px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[calc(2rem+var(--sab))]">
        <div class="text-center">
          <h1 class="text-[28px] sm:text-[42px] font-black tracking-[-0.04em] leading-[1.05] sm:leading-none dark:text-white text-balance">{{ pageTitle }}</h1>
          <p v-if="companyMeta?.version || companyMeta?.effective_date" class="mt-2 text-xs text-stone-500 dark:text-zinc-400">
            <span v-if="companyMeta?.version">Версия {{ companyMeta.version }}</span>
            <span v-if="companyMeta?.version && companyMeta?.effective_date"> · </span>
            <span v-if="companyMeta?.effective_date">действует с {{ companyMeta.effective_date }}</span>
          </p>
        </div>

        <div v-if="loading" class="mt-8 py-12 grid place-items-center">
          <span class="w-6 h-6 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
        </div>

        <div v-else-if="notFound || !refPage" class="mt-8">
          <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft">
            <template #content>
              <div class="p-6 text-center">
                <div class="text-lg font-bold dark:text-white">Страница пока не заполнена</div>
                <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Загляните позже — мы уже работаем над этим.</div>
                <Link href="/" class="inline-block mt-4"><Button label="На главную" rounded /></Link>
              </div>
            </template>
          </Card>
        </div>

        <div v-else class="mt-8 space-y-4">
          <Card v-if="refPage.body" class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft">
            <template #content>
              <div class="p-5 sm:p-6 text-sm leading-relaxed text-stone-700 dark:text-zinc-300 whitespace-pre-wrap">{{ refPage.body }}</div>
            </template>
          </Card>

          <Card v-if="hasCompanyBlock" class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft">
            <template #content>
              <div class="p-5 sm:p-6">
                <div class="text-xs font-bold tracking-widest uppercase text-stone-400">Данные организации</div>
                <dl class="mt-3 space-y-2 text-sm">
                  <div v-if="companyMeta?.company_name" class="flex flex-col sm:flex-row sm:gap-3">
                    <dt class="text-stone-500 dark:text-zinc-400 sm:w-32 shrink-0">Компания</dt>
                    <dd class="font-semibold dark:text-white">{{ companyMeta.company_name }}</dd>
                  </div>
                  <div v-if="companyMeta?.inn" class="flex flex-col sm:flex-row sm:gap-3">
                    <dt class="text-stone-500 dark:text-zinc-400 sm:w-32 shrink-0">ИНН</dt>
                    <dd class="font-semibold dark:text-white">{{ companyMeta.inn }}</dd>
                  </div>
                  <div v-if="companyMeta?.ogrn" class="flex flex-col sm:flex-row sm:gap-3">
                    <dt class="text-stone-500 dark:text-zinc-400 sm:w-32 shrink-0">ОГРН</dt>
                    <dd class="font-semibold dark:text-white">{{ companyMeta.ogrn }}</dd>
                  </div>
                  <div v-if="companyMeta?.address" class="flex flex-col sm:flex-row sm:gap-3">
                    <dt class="text-stone-500 dark:text-zinc-400 sm:w-32 shrink-0">Адрес</dt>
                    <dd class="font-semibold dark:text-white">{{ companyMeta.address }}</dd>
                  </div>
                  <div v-if="companyMeta?.email" class="flex flex-col sm:flex-row sm:gap-3">
                    <dt class="text-stone-500 dark:text-zinc-400 sm:w-32 shrink-0">Email</dt>
                    <dd><a :href="`mailto:${companyMeta.email}`" class="font-semibold text-teal-700 dark:text-teal-300 hover:underline">{{ companyMeta.email }}</a></dd>
                  </div>
                  <div v-if="companyMeta?.phone" class="flex flex-col sm:flex-row sm:gap-3">
                    <dt class="text-stone-500 dark:text-zinc-400 sm:w-32 shrink-0">Телефон</dt>
                    <dd><a :href="`tel:${companyMeta.phone}`" class="font-semibold text-teal-700 dark:text-teal-300 hover:underline">{{ companyMeta.phone }}</a></dd>
                  </div>
                </dl>
              </div>
            </template>
          </Card>

          <Card v-if="attachments.length" class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft">
            <template #content>
              <div class="p-5 sm:p-6">
                <div class="text-xs font-bold tracking-widest uppercase text-stone-400">Документы</div>
                <div class="mt-3 flex flex-col gap-2">
                  <a
                    v-for="(file, fileIndex) in attachments"
                    :key="fileIndex"
                    :href="file.url"
                    target="_blank"
                    class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 p-3 hover:bg-stone-50 dark:hover:bg-zinc-800 transition"
                  >
                    <span class="w-10 h-10 rounded-xl bg-ink-900 dark:bg-zinc-700 text-white grid place-items-center shrink-0"><i class="pi pi-file text-sm" /></span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold truncate dark:text-white">{{ file.name }}</span>
                      <span class="block text-[11px] text-stone-400">Открыть документ</span>
                    </span>
                    <i class="pi pi-external-link text-stone-400 text-sm shrink-0" />
                  </a>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </div>
  </component>
</template>
