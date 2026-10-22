<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import FileUpload from 'primevue/fileupload'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'

/**
 * Менеджер брендинга из админки: логотип приложения и favicon.
 *
 * Проп `mgr` — результат `useAdminBranding()` из страницы админки,
 * логика загрузки и сброса живёт в композабле.
 */
defineProps<{ mgr: any }>()

const hintClass = 'text-[11px] leading-relaxed text-stone-500 dark:text-zinc-400'
</script>

<template>
  <Card
    class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft"
    :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }"
  >
    <template #content>
      <div class="flex items-center gap-2">
        <span class="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#FD267D] to-[#F04D9F] text-white grid place-items-center shrink-0">
          <i class="pi pi-image text-sm" />
        </span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-bold text-stone-800 dark:text-zinc-100">Логотип и favicon</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">
            Иконка приложения, установка PWA и картинка во вкладке браузера.
          </div>
        </div>
        <Tag v-if="mgr.branding.value" value="сохранено" severity="success" class="!text-[9px]" />
      </div>

      <Message v-if="mgr.state.error" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">
        {{ mgr.state.error }}
      </Message>
      <Message v-else-if="mgr.state.notice" severity="success" :closable="false" class="!mt-3 !rounded-2xl !text-xs">
        {{ mgr.state.notice }}
      </Message>

      <div v-if="mgr.isLoading.value" class="py-8 grid place-items-center">
        <ProgressSpinner style="width: 24px; height: 24px" :strokeWidth="6" />
      </div>

      <div v-else class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section class="rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/60 p-3.5">
          <div class="flex items-start gap-3">
            <div class="w-20 h-20 shrink-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-700 grid place-items-center">
              <img
                v-if="mgr.branding.value?.app_icon?.url"
                :src="mgr.branding.value.app_icon.url"
                alt="Текущая иконка приложения"
                class="h-full w-full object-contain"
                decoding="async"
              />
              <i v-else class="pi pi-image text-2xl text-stone-400" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-bold text-stone-800 dark:text-zinc-100">Иконка приложения</div>
              <div :class="hintClass">
                Квадрат от 512×512 px, PNG / JPG / WebP до 4 МБ. Используется как логотип, apple-touch и иконка PWA.
              </div>
              <Tag
                :value="mgr.branding.value?.app_icon?.is_custom ? 'своя' : 'по умолчанию'"
                :severity="mgr.branding.value?.app_icon?.is_custom ? 'success' : 'secondary'"
                class="!mt-1.5 !text-[9px]"
              />
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <FileUpload
              :key="`icon-${mgr.branding.value?.version ?? '0'}`"
              mode="basic"
              accept="image/png,image/jpeg,image/webp"
              :auto="false"
              choose-label="Загрузить иконку"
              :disabled="mgr.isBusy.value"
              @select="mgr.handleAppIconSelect($event)"
            />
            <Button
              v-if="mgr.branding.value?.app_icon?.is_custom"
              label="Сбросить"
              icon="pi pi-times"
              size="small"
              severity="secondary"
              text
              :loading="mgr.state.busy === 'app_icon'"
              :disabled="mgr.isBusy.value"
              @click="mgr.reset('app_icon')"
            />
          </div>
        </section>

        <section class="rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/60 p-3.5">
          <div class="flex items-start gap-3">
            <div class="w-20 h-20 shrink-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-700 grid place-items-center">
              <img
                v-if="mgr.branding.value?.favicon?.url"
                :src="mgr.branding.value.favicon.url"
                alt="Текущий favicon"
                class="h-10 w-10 object-contain"
                decoding="async"
              />
              <i v-else class="pi pi-star text-2xl text-stone-400" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-bold text-stone-800 dark:text-zinc-100">Favicon</div>
              <div :class="hintClass">
                ICO или PNG до 512 КБ. Показывается во вкладке браузера и закладках.
              </div>
              <Tag
                :value="mgr.branding.value?.favicon?.is_custom ? 'свой' : 'по умолчанию'"
                :severity="mgr.branding.value?.favicon?.is_custom ? 'success' : 'secondary'"
                class="!mt-1.5 !text-[9px]"
              />
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <FileUpload
              :key="`favicon-${mgr.branding.value?.version ?? '0'}`"
              mode="basic"
              accept=".ico,image/png"
              :auto="false"
              choose-label="Загрузить favicon"
              :disabled="mgr.isBusy.value"
              @select="mgr.handleFaviconSelect($event)"
            />
            <Button
              v-if="mgr.branding.value?.favicon?.is_custom"
              label="Сбросить"
              icon="pi pi-times"
              size="small"
              severity="secondary"
              text
              :loading="mgr.state.busy === 'favicon'"
              :disabled="mgr.isBusy.value"
              @click="mgr.reset('favicon')"
            />
          </div>
        </section>
      </div>

      <div v-if="!mgr.isLoading.value" class="mt-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3.5 py-3">
        <div class="flex items-start gap-2">
          <i class="pi pi-info-circle text-amber-600 dark:text-amber-400 text-sm mt-0.5" />
          <div :class="hintClass">
            <span class="font-bold text-amber-700 dark:text-amber-300">Кэш:</span>
            после смены иконки обновите страницу. Уже установленное PWA может показать старую иконку до переустановки —
            это ограничение браузера, а не приложения.
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
